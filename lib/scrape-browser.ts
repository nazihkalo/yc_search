import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { getCrawl4AiPageTimeoutMs, getCrawl4AiPythonBin } from "./env";
import { withScrapeDomain, waitScrapeTurn, noteScrapeRateLimit, ScrapeRateLimitError } from "./scrape-policy";
import { proxyAllowed, proxyConfiguration, proxyBudgetSettings, reserveProxyRequest, settleProxyRequest, redactScrapeError } from "./scrape-proxy";
import { recordVendorMetric } from "./vendor-run-context";

export type BrowserDocument = {
  success: boolean; markdown?: string; text?: string; title?: string;
  links?: Array<{ text: string; href: string }>;
  workerPid?: number; browserVersion?: string; status?: number; retryAfter?: string; finalUrl?: string; bytes: number; error?: string;
};
export class BrowserFetchError extends Error {
  constructor(public document: BrowserDocument) { super(document.error || "Browser retrieval failed"); this.name = "BrowserFetchError"; }
}
class BrowserWorker {
  child: ChildProcessWithoutNullStreams;
  pending?: { id: string; resolve: (document: BrowserDocument) => void; reject: (error: Error) => void };
  alive = true;
  fresh = true;
  buffer = "";
  idle?: NodeJS.Timeout;
  constructor() {
    this.child = spawn(getCrawl4AiPythonBin(), ["-u", resolve(process.cwd(), "scripts/scrape-browser.py")], {
      detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      if (this.buffer.length > 10_000_000) return this.stop(new Error("Browser output exceeds budget"));
      let newline;
      while ((newline = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1);
        try {
          const parsed = JSON.parse(line);
          if (this.pending && (parsed.id === this.pending.id || (!parsed.id && parsed.success === false))) {
            this.pending.resolve(parsed); this.pending = undefined;
          }
        } catch { /* Non-protocol library output is never logged. */ }
      }
    });
    // Drain stderr, but never include source dumps/proxy credentials in errors.
    this.child.stderr.resume();
    this.child.stdin.on("error", () => this.stop(new Error("Browser worker pipe closed")));
    this.child.once("error", () => this.stop(new Error("Browser worker could not start; check Python/Playwright installation")));
    this.child.once("close", () => this.stop(new Error("Browser worker exited")));
  }
  references(active: boolean) {
    if (active) this.child.ref(); else this.child.unref();
    for (const stream of [this.child.stdin, this.child.stdout, this.child.stderr]) {
      const handle = stream as typeof stream & { ref?: () => void; unref?: () => void };
      if (active) handle.ref?.(); else handle.unref?.();
    }
  }
  stop(error = new Error("Browser worker closed")) {
    if (!this.alive) return;
    this.alive = false; clearTimeout(this.idle);
    this.pending?.reject(error); this.pending = undefined;
    try {
      if (this.child.pid && process.platform !== "win32") process.kill(-this.child.pid, "SIGKILL");
      else this.child.kill("SIGKILL");
    } catch { /* Process already exited. */ }
  }
  async request(url: string, signal: AbortSignal, proxy: boolean) {
    signal.throwIfAborted(); clearTimeout(this.idle); this.references(true);
    const id = randomUUID();
    const config = proxy ? proxyConfiguration() : null;
    const request = { id, url, context: new URL(url).hostname, timeout: getCrawl4AiPageTimeoutMs(),
      maxBytes: proxy ? proxyBudgetSettings().reservation : 20_000_000,
      ...(this.fresh ? { proxy: config ? { server: config.server, username: config.username, password: config.password } : null } : {}) };
    this.fresh = false;
    const abort = () => this.stop(new Error("Browser retrieval cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    try {
      return await new Promise<BrowserDocument>((resolve, reject) => {
        this.pending = { id, resolve, reject };
        if (signal.aborted) { abort(); return; }
        this.child.stdin.write(`${JSON.stringify(request)}\n`);
      });
    } finally {
      signal.removeEventListener("abort", abort);
      this.references(false);
      this.idle = setTimeout(() => this.stop(), 30_000); this.idle.unref();
    }
  }
}
type Slot = { tail: Promise<void>; worker?: BrowserWorker };
const slots = new Map<string, Slot>();
function slotFor(url: string, proxy: boolean) {
  const host = new URL(url).hostname;
  const raw = Number(process.env.SCRAPE_BROWSER_WORKERS ?? 2);
  const count = Number.isInteger(raw) && raw >= 1 && raw <= 4 ? raw : 2;
  const hash = [...host].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);
  const key = `${getCrawl4AiPythonBin()}:${proxy ? `proxy:${proxyConfiguration()?.fingerprint}` : "direct"}:${hash % (proxy ? 1 : count)}`;
  let slot = slots.get(key);
  if (!slot) { slot = { tail: Promise.resolve() }; slots.set(key, slot); }
  return slot;
}
export function closeScrapeBrowsers() { for (const slot of slots.values()) slot.worker?.stop(); slots.clear(); }
process.once("exit", closeScrapeBrowsers);
// Signal cleanup prevents detached Chromium processes surviving worker shutdown.
process.once("SIGTERM", closeScrapeBrowsers);
process.once("SIGINT", closeScrapeBrowsers);

export async function fetchBrowserDocument(url: string, options: { signal?: AbortSignal; proxy?: boolean } = {}) {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Unsupported browser URL");
  const proxy = Boolean(options.proxy);
  if (proxy && !proxyAllowed(url)) throw new Error("Residential proxy is disabled or this domain is not allowed");
  const deadline = AbortSignal.timeout(getCrawl4AiPageTimeoutMs() + 30_000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  return withScrapeDomain(url, signal, async () => {
    const slot = slotFor(url, proxy);
    const previous = slot.tail;
    let release!: () => void;
    slot.tail = new Promise<void>((resolve) => { release = resolve; });
    // The caller's deadline covers pool queuing as well as browser navigation.
    let acquired = false;
    try {
      await waitScrapeTurn(previous, signal); acquired = true; signal.throwIfAborted();
      const reservation = proxy ? await reserveProxyRequest() : null;
      if (proxy && !reservation) throw new Error("Residential proxy monthly allowance exhausted");
      let completed = false;
      try {
        if (!slot.worker?.alive) { recordVendorMetric("browser_process_starts"); slot.worker = new BrowserWorker(); }
        else recordVendorMetric("browser_process_reuses");
        if (proxy) recordVendorMetric("proxy_requests");
        const document = await slot.worker.request(url, signal, proxy);
        recordVendorMetric(proxy ? "proxy_measured_bytes" : "browser_measured_bytes", document.bytes || 0);
        if (reservation) await settleProxyRequest(reservation, document.success ? document.bytes : Math.max(reservation.bytes, document.bytes || 0));
        completed = true;
        if (document.status === 429 || document.status === 503 && document.retryAfter) {
          const delay = noteScrapeRateLimit(url, document.retryAfter);
          throw new ScrapeRateLimitError(delay, document.status);
        }
        if (!document.success) throw new BrowserFetchError(document);
        return document;
      } finally { if (reservation && !completed) await settleProxyRequest(reservation); }
    } catch (error) {
      if (error instanceof BrowserFetchError || error instanceof ScrapeRateLimitError) throw error;
      throw new Error(redactScrapeError(error));
    } finally { if (acquired) release(); else void previous.then(release); }
  });
}
