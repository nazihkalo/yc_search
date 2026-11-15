import { BrowserFetchError, fetchBrowserDocument } from "./scrape-browser";
import { proxyAllowed } from "./scrape-proxy";
import { ScrapeRateLimitError } from "./scrape-policy";

export async function fetchBrowserWithFallback(url: string, options: { signal?: AbortSignal; allowProxy?: boolean } = {}) {
  try {
    const direct = await fetchBrowserDocument(url, options);
    if ((direct.text?.trim().length ?? 0) >= 400 || !options.allowProxy || !proxyAllowed(url)) return direct;
  } catch (error) {
    // A cooldown should defer the job; invalid/missing/authenticated pages should
    // not incur residential charges. Network/timeout failures can be compared.
    if (error instanceof ScrapeRateLimitError || !options.allowProxy || !proxyAllowed(url) ||
      error instanceof BrowserFetchError && ([401, 404, 410].includes(error.document.status ?? 0) || /requires login/.test(error.message))) throw error;
  }
  return fetchBrowserDocument(url, { ...options, proxy: true });
}
