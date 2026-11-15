import { readBoundedHtml } from "./vendor-discovery";
import { withScrapeDomain, noteScrapeRateLimit, ScrapeRateLimitError } from "./scrape-policy";

export async function fetchScrapeHtml(url: string, options: {
  signal?: AbortSignal; timeoutMs?: number; maxBytes?: number; headers?: Record<string, string>; redirect?: RequestRedirect;
} = {}) {
  return withScrapeDomain(url, options.signal, async () => {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
    const response = await fetch(url, {
      redirect: options.redirect ?? "follow",
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      headers: { "User-Agent": "YCSearch/1.0 (+https://github.com/nazihkalo/yc_search)", Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", ...options.headers },
    });
    if (response.status === 429 || response.status === 503 && response.headers.has("retry-after")) {
      const delay = noteScrapeRateLimit(url, response.headers.get("retry-after"));
      await response.body?.cancel();
      throw new ScrapeRateLimitError(delay, response.status);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const html = /text\/html|text\/plain|application\/xhtml\+xml/.test(contentType) ? await readBoundedHtml(response, options.maxBytes ?? 512 * 1024) : "";
    if (!html) await response.body?.cancel();
    return { html, status: response.status, ok: response.ok, url: response.url, contentType, location: response.headers.get("location") };
  });
}
