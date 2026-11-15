import { type BrowserDocument } from "./scrape-browser";
import { fetchBrowserWithFallback } from "./scrape-fallback";

export function browserDocumentMarkdown(document: BrowserDocument, url: string) {
  const links = (document.links ?? []).filter((link) => /^https?:\/\//i.test(link.href))
    .filter((link) => !/powered_by_vanta|vanta\.com\/products\/trust-center/i.test(link.href)).slice(0, 300)
    .map((link) => `- [${link.text?.replace(/\s+/g, " ").trim() || link.href}](${link.href})`).join("\n");
  return [document.title ? `# ${document.title}` : "", `Source URL: ${url}`, document.text?.trim() ?? "", links ? `## Links\n${links}` : ""].filter(Boolean).join("\n\n");
}
export async function renderWebsiteMarkdown(url: string, options: { signal?: AbortSignal; allowProxy?: boolean } = {}) {
  return browserDocumentMarkdown(await fetchBrowserWithFallback(url, options), url);
}
