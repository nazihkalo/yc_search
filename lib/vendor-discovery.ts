// External trust centers are followed only when the company's own page links to
// them. Search results must additionally match an explicitly discovered URL.
export function isHostedTrustCenter(hostname: string) {
  return ["vanta.com", "safebase.io", "drata.com", "secureframe.com", "trustpage.com", "whistic.com"]
    .some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function hasFailedDisclosureSource(
  checks: Array<{ url: string; status: string; httpStatus?: number | null }>,
  authoritativeUrls: Set<string>,
  successfulUrls: Set<string>,
) {
  return checks.some((check) => authoritativeUrls.has(check.url) && !successfulUrls.has(check.url) && (
    ["timeout", "network_error", "dns_failed"].includes(check.status) ||
    [401, 403, 408, 429].includes(check.httpStatus ?? 0) || (check.httpStatus ?? 0) >= 500
  ));
}

export function htmlLinksAsMarkdown(html: string) {
  const decode = (value: string) => value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => `[${decode(match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())}](${decode(match[1])})`)
    .join("\n");
}

export async function readBoundedHtml(response: Response, maxBytes = 512 * 1024) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - size);
      chunks.push(chunk);
      size += chunk.byteLength;
    }
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
  return Buffer.concat(chunks).toString("utf8");
}
