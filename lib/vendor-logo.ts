export function vendorLogoUrl(domain: string | null | undefined, size = 64) {
  const cleanDomain = domain?.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  if (!cleanDomain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${size}`;
}
