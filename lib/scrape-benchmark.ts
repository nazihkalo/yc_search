import { load } from "cheerio";
import { fetchScrapeHtml } from "./scrape-http";
import { BrowserFetchError, fetchBrowserDocument } from "./scrape-browser";
import { proxyAllowed, redactScrapeError } from "./scrape-proxy";
import { ScrapeRateLimitError } from "./scrape-policy";
import { extractVendorMentionsFromMarkdown, getVendorEvidenceRejectionReason } from "./vendor-intelligence";
import { extractLinkedInRanking } from "./company-discovery/extract";
import { sha256 } from "./hash";

export type ScrapeTarget = { name: string; url: string; kind?: "vendor" | "company_list" | "page" };
export type ScrapeMode = "http" | "browser" | "residential";
export type ScrapeMeasurement = {
  mode: ScrapeMode; url: string; durationMs: number; status: number | null; requestMade: boolean;
  outcome: "usable" | "thin" | "blocked" | "rate_limited" | "missing" | "error" | "not_configured" | "parked";
  measuredBytes: number | null; characters: number; contentHash: string | null;
  listMembers: number | null; vendorCandidates: Array<{ name: string; evidence: string }>;
  manuallyVerifiedExtraction: boolean | null; error?: string;
};
export function benchmarkTargets(pilot: { companies: Array<{ name: string; website?: string | null; outcome?: string; last_error?: string | null }> }, limit: number): ScrapeTarget[] {
  const unique = new Set<string>();
  const priority = (error?: string | null) => /HTTP (403|429)|anti.bot/i.test(error ?? "") ? 0 : /exceeded|timeout/i.test(error ?? "") ? 1 : 2;
  return pilot.companies.filter((row) => row.outcome === "crawl_failed" && row.website)
    .sort((a, b) => priority(a.last_error) - priority(b.last_error) || a.name.localeCompare(b.name))
    .flatMap((row) => {
      try {
        const url = new URL(/^https?:\/\//.test(row.website!) ? row.website! : `https://${row.website}`);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || unique.has(url.hostname)) return [];
        unique.add(url.hostname);
        return [{ name: row.name, url: url.href, kind: "page" as const }];
      } catch { return []; }
    }).slice(0, limit);
}
function htmlDocument(html: string) {
  const $ = load(html); $("script,style,nav,footer,aside").remove();
  $("h1,h2,h3,h4").each((_, el) => { $(el).prepend(`${"#".repeat(Number(el.tagName.slice(1)))} `); });
  $("a[href]").each((_, anchor) => { const a = $(anchor); a.replaceWith(`[${a.text()}](${a.attr("href")})`); });
  $("p,h1,h2,h3,h4,li,tr,div,br").each((_, el) => { $(el).append("\n"); });
  return $("body").text().trim();
}
export async function measureScrape(target: ScrapeTarget, mode: ScrapeMode): Promise<ScrapeMeasurement> {
  const started = Date.now();
  const result: ScrapeMeasurement = { mode, url: target.url, durationMs: 0, status: null, requestMade: false, outcome: "error", measuredBytes: null, characters: 0, contentHash: null, listMembers: null, vendorCandidates: [], manuallyVerifiedExtraction: null };
  if (mode === "residential" && !proxyAllowed(target.url)) return { ...result, outcome: "not_configured", error: "Proxy disabled, missing credentials, or domain not allowed" };
  try {
    const timeoutMs = Number(process.env.SCRAPE_COMPARE_TIMEOUT_MS ?? 20_000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) throw new Error("Invalid SCRAPE_COMPARE_TIMEOUT_MS");
    result.requestMade = true;
    let markdown: string;
    if (mode === "http") {
      const page = await fetchScrapeHtml(target.url, { timeoutMs, maxBytes: 2_000_000 });
      result.status = page.status;
      // HTTP body length is decoded HTML, not billed browser/proxy bandwidth.
      markdown = htmlDocument(page.html);
    } else {
      const page = await fetchBrowserDocument(target.url, { proxy: mode === "residential", signal: AbortSignal.timeout(timeoutMs) });
      result.status = page.status ?? null; result.measuredBytes = page.bytes;
      markdown = page.markdown ?? page.text ?? "";
    }
    result.characters = markdown.length; result.contentHash = sha256(markdown);
    result.outcome = [401, 403].includes(result.status ?? 0) || /access denied|verify you are human|checking your browser|just a moment\.\.\./i.test(markdown.slice(0, 1000)) ? "blocked"
      : /domain is for sale|buy this domain|related searches|namecheap parking/i.test(markdown.slice(0, 5000)) ? "parked"
      : [404, 410].includes(result.status ?? 0) ? "missing"
      : (result.status ?? 200) >= 400 ? "error" : markdown.length >= 400 ? "usable" : "thin";
    if (result.outcome === "usable") {
      try { result.listMembers = extractLinkedInRanking(markdown)?.members.length ?? null; } catch { result.listMembers = null; }
      if (target.kind === "vendor") result.vendorCandidates = extractVendorMentionsFromMarkdown(markdown, target.url, `benchmark_${mode}`)
        .filter((mention) => !getVendorEvidenceRejectionReason(mention)).slice(0, 50)
        .map((mention) => ({ name: mention.canonicalName, evidence: mention.evidenceSnippet.slice(0, 600) }));
    }
  } catch (error) {
    if (error instanceof ScrapeRateLimitError) { result.status = error.httpStatus ?? null; result.requestMade = !error.deferred; }
    if (error instanceof BrowserFetchError) { result.status = error.document.status ?? null; result.measuredBytes = error.document.bytes; }
    result.outcome = error instanceof ScrapeRateLimitError ? "rate_limited" : [404, 410].includes(result.status ?? 0) ? "missing" : error instanceof BrowserFetchError && /challenge|HTTP 403|requires login/.test(error.message) ? "blocked" : "error";
    result.error = redactScrapeError(error);
  }
  return { ...result, durationMs: Date.now() - started };
}

export function summarizeScrapeComparison(rows: Array<{ measurements: ScrapeMeasurement[] }>, usdPerGb = 4) {
  return (["http", "browser", "residential"] as const).map((mode) => {
    const measurements = rows.flatMap((row) => row.measurements.filter((m) => m.mode === mode && m.outcome !== "not_configured"));
    const active = measurements.filter((m) => m.requestMade);
    const usable = active.filter((m) => m.outcome === "usable").length;
    const bytes = active.reduce((sum, m) => sum + (m.measuredBytes ?? 0), 0);
    const missing = active.filter((m) => m.measuredBytes === null).length;
    const verified = active.filter((m) => m.manuallyVerifiedExtraction === true).length;
    const estimatedUsd = mode === "residential" && active.length && !missing ? bytes / 1_000_000_000 * usdPerGb : null;
    return { mode, attempted: active.length, deferred: measurements.filter((m) => !m.requestMade).length, usable, verifiedExtractions: verified,
      measuredBytes: bytes, missingByteMeasurements: missing, measuredTransferUsdEstimate: estimatedUsd,
      usdPerUsablePage: estimatedUsd !== null && usable ? estimatedUsd / usable : null,
      usdPerVerifiedExtraction: estimatedUsd !== null && verified ? estimatedUsd / verified : null };
  });
}
