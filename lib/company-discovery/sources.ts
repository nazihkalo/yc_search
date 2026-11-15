export const PUBLISHERS = {
  linkedin: { domain: "linkedin.com", hubs: ["https://www.linkedin.com/hubs/top-companies/"], families: ["Top Startups", "Top Companies"] },
  cnbc: { domain: "cnbc.com", hubs: ["https://www.cnbc.com/cnbc-disruptors/"], families: ["Disruptor 50", "Top Startups"] },
  fortune: { domain: "fortune.com", hubs: ["https://fortune.com/ranking/ai-innovators/"], families: ["AI Innovators", "Future 50"] },
  forbes: { domain: "forbes.com", hubs: ["https://www.forbes.com/lists/ai50/", "https://www.forbes.com/lists/cloud100/"], families: ["AI 50", "Cloud 100", "Next Billion Dollar Startups"] },
} as const;
export type Publisher = keyof typeof PUBLISHERS;

const linkedinSlugs = [
  "linkedin-top-startups-2026-50-us-companies-rise-linkedin-news-pzfoe/",
  "linkedin-top-startups-2026-20-australian-companies-lnpsf/",
  "linkedin-top-startups-de-2026-20-novas-empresas-do-brasil-nuy4e/",
  "linkedin-top-startups-2026-les-20-p%25C3%25A9pites-fran%25C3%25A7aises-u8fge/",
  "linkedin-top-startups-2026-20-aufstrebende-unternehmen-lbwge",
  "linkedin-top-startups-2026-20-indian-companies-rise-wfsac",
  "linkedin-top-startups-2026-15-israeli-companies-rise-linkedin-news-ku2ef",
  "linkedin-top-startups-2026-10-aziende-italiane-crescita-vodcc",
  "linkedin-top-startups-2026-de-10-jonge-topbedrijven-nederland-8dm9e/",
  "linkedin-top-startups-2026-10-singapore-companies-rise-ota8f/",
  "top-startups-2026-de-linkedin-las-20-empresas-n2bnc",
  "linkedin-top-startups-2026-20-uk-companies-rise-linkedin-news-uk-xoffc",
];
export const DISCOVERY_SEEDS = [
  ...linkedinSlugs.map((slug) => ({ url: `https://www.linkedin.com/pulse/${slug}`, kind: "list" as const })),
  ...Object.values(PUBLISHERS).flatMap((publisher) => publisher.hubs.map((url) => ({ url, kind: "hub" as const }))),
];

export function publisherOf(url: string): Publisher | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    return (Object.keys(PUBLISHERS) as Publisher[]).find((key) => {
      const domain = PUBLISHERS[key].domain;
      return parsed.hostname === domain || parsed.hostname === `www.${domain}`;
    }) ?? null;
  } catch { return null; }
}

export function canonicalListUrl(input: string): string | null {
  if (!publisherOf(input)) return null;
  const url = new URL(input);
  url.hash = "";
  // Tracking URLs must not create duplicate lists; preserve encoded path bytes.
  url.search = "";
  url.hostname = `www.${PUBLISHERS[publisherOf(input)!].domain}`;
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

export function looksLikeList(url: string, label = "") {
  return Boolean(canonicalListUrl(url)) && /top[-\s]*(?:startups|companies)|disruptor|ai[-\s]*50|cloud[-\s]*100|ai[-\s]*innovators|future[-\s]*50|billion[-\s]*dollar[-\s]*startups/i.test(`${url} ${label}`);
}

export function discoveryQueries(year: number, lookback = 4) {
  return Object.values(PUBLISHERS).flatMap((p) => p.families.flatMap((family) =>
    Array.from({ length: lookback + 1 }, (_, index) => `site:${p.domain} "${family}" ${year - index}`),
  ));
}
