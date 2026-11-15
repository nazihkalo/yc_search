import { setTimeout as sleep } from "node:timers/promises";
import { getDomain } from "tldts";

export function scrapeDomain(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  return getDomain(host, { allowPrivateDomains: true }) ?? host;
}
export function retryAfterMs(value: string | null | undefined, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const delay = /^\d+(?:\.\d+)?$/.test(value.trim()) && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, Math.min(24 * 60 * 60_000, delay)) : 0;
}
export class ScrapeRateLimitError extends Error {
  constructor(public retryAfterMs: number, public httpStatus?: number, public deferred = false) { super(`Publisher rate limited; retry after ${Math.ceil(retryAfterMs / 1000)}s`); this.name = "ScrapeRateLimitError"; }
}
type Gate = { tail: Promise<void>; pending: number; next: number };
const gates = new Map<string, Gate>();
function gateFor(url: string) {
  const domain = scrapeDomain(url);
  let gate = gates.get(domain);
  if (!gate) {
    if (gates.size >= 5000) for (const [key, old] of gates) if (!old.pending && old.next <= Date.now()) gates.delete(key);
    gate = { tail: Promise.resolve(), pending: 0, next: 0 }; gates.set(domain, gate);
  }
  return gate;
}
export function noteScrapeRateLimit(url: string, retryAfter: string | null | undefined) {
  const delay = retryAfterMs(retryAfter) || 60_000;
  const gate = gateFor(url);
  gate.next = Math.max(gate.next, Date.now() + delay);
  return delay;
}
export function waitScrapeTurn(promise: Promise<void>, signal?: AbortSignal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Scrape cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(() => { signal.removeEventListener("abort", abort); resolve(); }, reject);
  });
}
export async function withScrapeDomain<T>(url: string, signal: AbortSignal | undefined, operation: () => Promise<T>) {
  signal?.throwIfAborted();
  const gate = gateFor(url);
  const previous = gate.tail;
  let release!: () => void;
  gate.tail = new Promise<void>((resolve) => { release = resolve; });
  gate.pending++;
  let acquired = false;
  try {
    await waitScrapeTurn(previous, signal); acquired = true;
    const raw = Number(process.env.SCRAPE_DOMAIN_DELAY_MS ?? 1000);
    const delay = Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 60_000) : 1000;
    const wait = gate.next - Date.now();
    // A long cooldown should defer the job, rather than consuming its crawl
    // deadline and all its retries in a sleeping browser task.
    if (wait > delay + 1000) throw new ScrapeRateLimitError(wait, undefined, true);
    if (wait > 0) await sleep(wait, undefined, { signal });
    signal?.throwIfAborted();
    try { return await operation(); }
    finally { gate.next = Math.max(gate.next, Date.now() + delay); }
  } finally {
    gate.pending--;
    if (acquired) release(); else void previous.then(release);
  }
}
