import { extractUrlsFromMarkdown } from "./snapshot-utils";

export type CompanyLink = {
  label: string;
  url: string;
  kind: "website" | "yc" | "x" | "linkedin" | "founder" | "github" | "other";
};

type BuildCompanyLinksInput = {
  website?: string | null;
  ycUrl?: string | null;
  snapshotWebsiteUrl?: string | null;
  contentMarkdown?: string | null;
};

function normalizeUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function getHostname(url: string | null | undefined) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isFilteredPath(pathname: string) {
  const lowered = pathname.toLowerCase();
  return [
    "/privacy",
    "/terms",
    "/legal",
    "/cookie",
    "/cookies",
    "/careers",
    "/jobs",
    "/blog",
    "/docs",
    "/pricing",
  ].some((fragment) => lowered.startsWith(fragment));
}

function classifyUrl(url: string, canonicalWebsiteHost: string): CompanyLink | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (hostname === canonicalWebsiteHost) {
      if (!pathname || pathname === "/") {
        return { label: "Website", url, kind: "website" };
      }
      if (isFilteredPath(pathname)) {
        return null;
      }
      return { label: "Product", url, kind: "other" };
    }

    if (hostname.includes("ycombinator.com")) {
      return { label: "YC", url, kind: "yc" };
    }

    if (hostname.includes("linkedin.com")) {
      if (pathname.startsWith("/in/")) {
        return { label: "Founder", url, kind: "founder" };
      }
      return { label: "LinkedIn", url, kind: "linkedin" };
    }

    if (hostname === "x.com" || hostname === "twitter.com" || hostname.endsWith(".x.com")) {
      return { label: "X", url, kind: "x" };
    }

    if (hostname.includes("github.com")) {
      return { label: "GitHub", url, kind: "github" };
    }

    if (isFilteredPath(pathname)) {
      return null;
    }

    return { label: hostname.replace(/\.(com|io|ai|co|dev|app|org)$/i, ""), url, kind: "other" };
  } catch {
    return null;
  }
}

function dedupeLinks(links: CompanyLink[]) {
  const seen = new Set<string>();
  const unique: CompanyLink[] = [];

  for (const link of links) {
    const normalized = normalizeUrl(link.url);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push({ ...link, url: normalized });
  }

  return unique;
}

const KIND_PRIORITY: Record<CompanyLink["kind"], number> = {
  website: 0,
  x: 1,
  linkedin: 2,
  founder: 3,
  github: 4,
  yc: 5,
  other: 6,
};

export function buildCompanyLinks({
  website,
  ycUrl,
  snapshotWebsiteUrl,
  contentMarkdown,
}: BuildCompanyLinksInput): CompanyLink[] {
  const canonicalWebsite = normalizeUrl(website ?? "") ?? normalizeUrl(snapshotWebsiteUrl ?? "") ?? null;
  const canonicalWebsiteHost = getHostname(canonicalWebsite);

  const derived = [
    canonicalWebsite ? { label: "Website", url: canonicalWebsite, kind: "website" as const } : null,
    ycUrl ? { label: "YC", url: ycUrl, kind: "yc" as const } : null,
    ...(contentMarkdown ? extractUrlsFromMarkdown(contentMarkdown).map((url) => classifyUrl(url, canonicalWebsiteHost)) : []),
  ].filter((item): item is CompanyLink => Boolean(item));

  const unique = dedupeLinks(derived);

  return unique
    .sort((left, right) => {
      if (KIND_PRIORITY[left.kind] !== KIND_PRIORITY[right.kind]) {
        return KIND_PRIORITY[left.kind] - KIND_PRIORITY[right.kind];
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, 6);
}
