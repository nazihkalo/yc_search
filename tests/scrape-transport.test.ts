import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { closeDb, getDb } from "../lib/db";
import { SCRAPE_BUDGET_SCHEMA } from "../lib/scrape-schema";
import { retryAfterMs, withScrapeDomain, noteScrapeRateLimit, ScrapeRateLimitError } from "../lib/scrape-policy";
import { proxyAllowed, proxyConfiguration, reserveProxyRequest, settleProxyRequest, redactScrapeError } from "../lib/scrape-proxy";
import { BrowserFetchError, closeScrapeBrowsers, fetchBrowserDocument } from "../lib/scrape-browser";
import { fetchBrowserWithFallback } from "../lib/scrape-fallback";
import { fetchScrapeHtml } from "../lib/scrape-http";
import { benchmarkTargets, measureScrape, summarizeScrapeComparison } from "../lib/scrape-benchmark";

const testUrl = process.env.SCRAPE_TEST_DATABASE_URL;
const schema = `scrape_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let server: Server;
let proxy: Server;
let origin: string;
let proxyOrigin: string;
let images = 0;
let cookie = "";
let userAgent = "";
let proxyAuthorization = "";
const paragraph = "Our subprocessors provide services and process customer data on our behalf under contract. ".repeat(8);
const html = `<html><head><title>Public disclosure</title></head><body><h1>Subprocessors</h1><p>${paragraph}</p><p>Stripe provides payment processing services.</p><img src="/image"><script>document.body.dataset.ready='yes'</script></body></html>`;

before(async () => {
  if (!testUrl || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(testUrl).hostname)) throw new Error("Set SCRAPE_TEST_DATABASE_URL to disposable local Postgres");
  if (!process.env.SCRAPE_TEST_PYTHON_BIN) throw new Error("Set SCRAPE_TEST_PYTHON_BIN to Python with Crawl4AI and Playwright Chromium installed");
  process.env.CRAWL4AI_PYTHON_BIN = process.env.SCRAPE_TEST_PYTHON_BIN;
  process.env.SCRAPE_DOMAIN_DELAY_MS = "0";
  process.env.CRAWL4AI_PAGE_TIMEOUT_MS = "5000";
  delete process.env.SCRAPE_PROXY_ENABLED;
  delete process.env.SCRAPE_PROXY_URL;
  admin = new Pool({ connectionString: testUrl }); await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(testUrl); scoped.searchParams.set("options", `-csearch_path=${schema}`); process.env.DATABASE_URL = scoped.href;
  await getDb().query(SCRAPE_BUDGET_SCHEMA);
  server = createServer((req, res) => {
    userAgent = req.headers["user-agent"] ?? "";
    if (req.url === "/image") { images++; res.end("image"); return; }
    if (req.url === "/slow") { req.once("close", () => res.end()); return; }
    if (req.url === "/blocked") { res.writeHead(403, { "content-type": "text/html" }); res.end("Forbidden"); return; }
    if (req.url === "/rate") { res.writeHead(429, { "retry-after": "60", "content-type": "text/html" }); res.end("Slow down"); return; }
    if (req.url === "/first") res.setHeader("set-cookie", "session=retained; Path=/");
    if (req.url === "/second") cookie = req.headers.cookie ?? "";
    res.setHeader("content-type", "text/html"); res.end(html);
  });
  proxy = createServer((req, res) => {
    proxyAuthorization = req.headers["proxy-authorization"] ?? "";
    if (!proxyAuthorization) { res.writeHead(407, { "proxy-authenticate": 'Basic realm="fixture"' }); res.end(); return; }
    res.setHeader("content-type", "text/html"); res.end(html);
  });
  for (const s of [server, proxy]) await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const address = server.address(); const proxyAddress = proxy.address();
  assert(address && typeof address !== "string" && proxyAddress && typeof proxyAddress !== "string");
  origin = `http://127.0.0.1:${address.port}`; proxyOrigin = `http://proxy-user:proxy-password@127.0.0.1:${proxyAddress.port}`;
});
after(async () => {
  closeScrapeBrowsers();
  for (const s of [server, proxy]) if (s) { s.closeAllConnections(); await new Promise<void>((resolve) => s.close(() => resolve())); }
  await closeDb(); if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});

test("Retry-After accepts seconds and dates, and clamps unbounded cooldowns", () => {
  assert.equal(retryAfterMs("15"), 15_000);
  assert.equal(retryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT", Date.parse("2026-10-21T07:27:30Z")), 30_000);
  assert.equal(retryAfterMs("not-a-date"), 0);
  assert.equal(retryAfterMs("9999999999"), 86_400_000);
});

test("domain gate serializes siblings, and cancellation cannot release another request's slot", async () => {
  let release!: () => void; let ready!: () => void; let entered = false;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const first = withScrapeDomain("https://a.gate.test", undefined, async () => { ready(); await held; });
  await started;
  const controller = new AbortController();
  const second = withScrapeDomain("https://b.gate.test", controller.signal, async () => { throw new Error("Cancelled request must not run"); });
  const rejected = assert.rejects(second);
  controller.abort(); await rejected;
  const third = withScrapeDomain("https://c.gate.test", undefined, async () => { entered = true; });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(entered, false);
  release(); await Promise.all([first, third]); assert.equal(entered, true);
});

test("long rate limits defer work without sleeping through a job deadline", async () => {
  noteScrapeRateLimit("https://rate-limited.test", "120");
  let called = false;
  await assert.rejects(withScrapeDomain("https://rate-limited.test/path", undefined, async () => { called = true; }), ScrapeRateLimitError);
  assert.equal(called, false);
});

test("HTTP requests preserve content and respect Retry-After", async () => {
  const page = await fetchScrapeHtml(`${origin}/first`); assert.equal(page.status, 200); assert.ok(page.html.includes("Stripe"));
  await assert.rejects(fetchScrapeHtml(`${origin.replace("127.0.0.1", "localhost")}/rate`), ScrapeRateLimitError);
});

test("real browser reuses its process/session, retains text, and blocks image traffic", async () => {
  const first = await fetchBrowserDocument(`${origin}/first`);
  const second = await fetchBrowserDocument(`${origin}/second`);
  assert.equal(first.success, true); assert.ok(first.workerPid);
  assert.equal(first.workerPid, second.workerPid);
  assert.match(cookie, /session=retained/);
  assert.ok(second.markdown?.includes("Stripe")); assert.ok(second.bytes > 0);
  assert.equal(images, 0);
  assert.ok(first.browserVersion);
  assert.ok(userAgent.includes(`Chrome/${first.browserVersion}`));
  assert.ok(!userAgent.includes("HeadlessChrome/"));
});

test("aborting a pooled browser kills its process and the next request recovers", async () => {
  const old = await fetchBrowserDocument(`${origin}/first`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  await assert.rejects(fetchBrowserDocument(`${origin}/slow`, { signal: controller.signal }), /cancel/i); clearTimeout(timer);
  const next = await fetchBrowserDocument(`${origin}/first`);
  assert.notEqual(next.workerPid, old.workerPid);
  assert.throws(() => process.kill(old.workerPid!, 0), /ESRCH/);
});

test("proxy requires both explicit enablement and a matching domain allowlist", async () => {
  process.env.SCRAPE_PROXY_URL = proxyOrigin;
  process.env.SCRAPE_PROXY_DOMAINS = "example.test";
  assert.equal(proxyAllowed("https://example.test"), false);
  await assert.rejects(fetchBrowserDocument("https://example.test", { proxy: true }), /disabled/);
  process.env.SCRAPE_PROXY_ENABLED = "1";
  assert.equal(proxyAllowed("https://sub.example.test"), true);
  assert.equal(proxyAllowed("https://example.test.evil.test"), false);
  assert.equal(proxyAllowed("https://notexample.test"), false);
  assert.equal(proxyConfiguration()?.username, "proxy-user");
  const error = redactScrapeError(new Error(`Failed ${proxyOrigin} using proxy-password`));
  assert.ok(!error.includes("proxy-password")); assert.ok(!error.includes("proxy-user"));
  delete process.env.SCRAPE_PROXY_ENABLED;
});

test("concurrent proxy reservations stay within quota, and settlement is idempotent", async () => {
  process.env.SCRAPE_PROXY_MONTHLY_USD = "0.008"; process.env.SCRAPE_PROXY_USD_PER_GB = "4"; process.env.SCRAPE_PROXY_REQUEST_MB = "1";
  const reservations = (await Promise.all(Array.from({ length: 8 }, () => reserveProxyRequest()))).filter((r) => r !== null);
  assert.equal(reservations.length, 2);
  await Promise.all([settleProxyRequest(reservations[0], 200), settleProxyRequest(reservations[0], 200)]);
  const row = (await getDb().query("SELECT * FROM scrape_proxy_budget")).rows[0];
  assert.equal(Number(row.reserved_bytes), 1_000_000); assert.equal(Number(row.measured_bytes), 200);
  await settleProxyRequest(reservations[1]);
  assert.equal((await reserveProxyRequest()), null);
  delete process.env.SCRAPE_PROXY_MONTHLY_USD; delete process.env.SCRAPE_PROXY_REQUEST_MB;
});

test("real browser authenticates to a fixture proxy and settles measured traffic", async () => {
  process.env.SCRAPE_PROXY_ENABLED = "1"; process.env.SCRAPE_PROXY_URL = proxyOrigin; process.env.SCRAPE_PROXY_DOMAINS = "example.test";
  const page = await fetchBrowserDocument("http://proxy-fixture.example.test/disclosure", { proxy: true });
  assert.ok(page.markdown?.includes("Stripe")); assert.equal(page.status, 200);
  assert.equal(proxyAuthorization, `Basic ${Buffer.from("proxy-user:proxy-password").toString("base64")}`);
  const row = (await getDb().query("SELECT * FROM scrape_proxy_budget")).rows[0]; assert.equal(Number(row.reserved_bytes), 0);
  assert.ok(Number(row.measured_bytes) >= page.bytes);
  const recovered = await fetchBrowserWithFallback("http://fallback.example.test/disclosure", { allowProxy: true });
  assert.ok(recovered.markdown?.includes("Stripe"));
  delete process.env.SCRAPE_PROXY_ENABLED;
});

test("blocked direct retrieval does not silently spend money when proxy is off", async () => {
  const before = Number((await getDb().query("SELECT SUM(requests) AS count FROM scrape_proxy_budget")).rows[0].count);
  await assert.rejects(fetchBrowserWithFallback(`${origin}/blocked`, { allowProxy: true }), BrowserFetchError);
  const after = Number((await getDb().query("SELECT SUM(requests) AS count FROM scrape_proxy_budget")).rows[0].count);
  assert.equal(after, before);
});

test("comparison selects a stable failed cohort and distinguishes access from extraction", async () => {
  const cohort = benchmarkTargets({ companies: [
    { name: "Blocked", website: "https://blocked.test", outcome: "crawl_failed", last_error: "HTTP 403" },
    { name: "Duplicate", website: "https://blocked.test/path", outcome: "crawl_failed" },
    { name: "Passed", website: "https://passed.test", outcome: "found_vendors" },
  ] }, 20);
  assert.equal(cohort.length, 1); assert.equal(cohort[0].name, "Blocked"); assert.equal(cohort[0].kind, "page");
  const page = await measureScrape({ name: "Fixture", url: `${origin}/first`, kind: "vendor" }, "http");
  assert.equal(page.outcome, "usable"); assert.equal(page.manuallyVerifiedExtraction, null);
  assert.ok(page.vendorCandidates.some((v) => v.name === "Stripe"));
  assert.equal((await measureScrape({ name: "Fixture", url: origin }, "residential")).outcome, "not_configured");
});


test("comparison pricing separates readable pages from verified extraction", async () => {
  const measurement = await measureScrape({ name: "Fixture", url: `${origin}/first` }, "http");
  const proxy = { ...measurement, mode: "residential" as const, measuredBytes: 1_000_000 };
  const initial = summarizeScrapeComparison([{ measurements: [proxy] }], 4).find((row) => row.mode === "residential")!;
  assert.equal(initial.attempted, 1); assert.equal(initial.usable, 1);
  assert.equal(initial.measuredTransferUsdEstimate, 0.004);
  assert.equal(initial.usdPerVerifiedExtraction, null);
  const reviewed = summarizeScrapeComparison([{ measurements: [{ ...proxy, manuallyVerifiedExtraction: true }] }], 4).find((row) => row.mode === "residential")!;
  assert.equal(reviewed.usdPerVerifiedExtraction, 0.004);
  const deferred = summarizeScrapeComparison([{ measurements: [{ ...proxy, requestMade: false, outcome: "rate_limited" }] }], 4).find((row) => row.mode === "residential")!;
  assert.equal(deferred.attempted, 0); assert.equal(deferred.deferred, 1);
  assert.equal(deferred.measuredBytes, 0); assert.equal(deferred.measuredTransferUsdEstimate, null);
});
