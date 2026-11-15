import { fetchBrowserWithFallback } from "./scrape-fallback";

// Playwright retains a small pool of browsers/contexts; Crawl4AI converts each
// rendered DOM to Markdown in the same Python worker, preserving links/headings.
export async function scrapeWebsiteMarkdown(url: string, options: { signal?: AbortSignal; allowProxy?: boolean } = {}): Promise<string> {
  const document = await fetchBrowserWithFallback(url, options);
  return (document.markdown ?? "").trim();
}
