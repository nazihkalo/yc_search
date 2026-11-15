import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "./db";

export function proxyConfiguration() {
  const raw = process.env.SCRAPE_PROXY_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) throw new Error();
    return { server: `${url.protocol}//${url.host}`, username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), fingerprint: createHash("sha256").update(raw).digest("hex").slice(0, 16) };
  } catch { throw new Error("Invalid SCRAPE_PROXY_URL; expected a proxy endpoint with optional username/password"); }
}
export function proxyAllowed(url: string) {
  if (process.env.SCRAPE_PROXY_ENABLED !== "1" || !process.env.SCRAPE_PROXY_URL) return false;
  const host = new URL(url).hostname.toLowerCase();
  return (process.env.SCRAPE_PROXY_DOMAINS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
    .some((domain) => host === domain || host.endsWith(`.${domain}`));
}
export function redactScrapeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  const raw = process.env.SCRAPE_PROXY_URL;
  if (raw) {
    message = message.split(raw).join("[proxy]");
    try {
      const url = new URL(raw);
      for (const secret of [url.username, url.password, decodeURIComponent(url.username), decodeURIComponent(url.password)]) if (secret) message = message.split(secret).join("[redacted]");
    } catch { /* Invalid config is reported without its value. */ }
  }
  return message.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, "$1[redacted]@").slice(0, 1000);
}
function positive(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${name}`);
  return n;
}
export function proxyBudgetSettings() {
  const dollars = positive("SCRAPE_PROXY_MONTHLY_USD", 10);
  const rate = positive("SCRAPE_PROXY_USD_PER_GB", 4);
  return { maxBytes: Math.floor(dollars / rate * 1_000_000_000), reservation: Math.ceil(positive("SCRAPE_PROXY_REQUEST_MB", 10) * 1_000_000) };
}
export async function reserveProxyRequest() {
  const { maxBytes, reservation } = proxyBudgetSettings();
  // Shared by replicas. Reservations abandoned by a crash stay charged for the
  // month, conservatively reducing the remaining allowance.
  return withTransaction(async (client) => {
    const month = (await client.query<{ month: string }>("SELECT TO_CHAR(NOW() AT TIME ZONE 'UTC','YYYY-MM') AS month")).rows[0].month;
    await client.query("INSERT INTO scrape_proxy_budget(month) VALUES ($1) ON CONFLICT DO NOTHING", [month]);
    const result = await client.query(`UPDATE scrape_proxy_budget SET reserved_bytes=reserved_bytes+$2,requests=requests+1
      WHERE month=$1 AND reserved_bytes+measured_bytes+$2<=$3 RETURNING month`, [month, reservation, maxBytes]);
    if (!result.rowCount) return null;
    const id = randomUUID();
    await client.query("INSERT INTO scrape_proxy_requests(id,month,reserved_bytes) VALUES ($1,$2,$3)", [id, month, reservation]);
    return { id, month, bytes: reservation };
  });
}
export async function settleProxyRequest(reservation: { id: string; month: string; bytes: number }, measuredBytes?: number) {
  // Failed/aborted transfers are charged at least their full reservation since
  // the browser may not have reported all bytes already billed by the provider.
  const billed = measuredBytes === undefined ? reservation.bytes : Math.max(0, Math.ceil(measuredBytes));
  await withTransaction(async (client) => {
    const claimed = await client.query("UPDATE scrape_proxy_requests SET measured_bytes=$2,settled_at=NOW() WHERE id=$1 AND settled_at IS NULL RETURNING month,reserved_bytes", [reservation.id, billed]);
    if (!claimed.rowCount) return;
    await client.query(`UPDATE scrape_proxy_budget SET reserved_bytes=GREATEST(0,reserved_bytes-$2),measured_bytes=measured_bytes+$3 WHERE month=$1`, [claimed.rows[0].month, claimed.rows[0].reserved_bytes, billed]);
  });
}
