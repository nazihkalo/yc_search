import { z } from "zod";

import { getYcProfileFetchTimeoutMs } from "./env";

const nullableString = z.string().nullable().optional().transform((value) => normalizeString(value ?? null));

const ycFounderSchema = z.object({
  user_id: z.number().nullable().optional(),
  is_active: z.boolean().nullable().optional().transform((value) => Boolean(value)),
  founder_bio: nullableString,
  full_name: z.string(),
  title: nullableString,
  avatar_thumb_url: nullableString,
  linkedin_url: nullableString,
  twitter_url: nullableString,
});

const ycCompanySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  website: nullableString,
  linkedin_url: nullableString,
  twitter_url: nullableString,
  github_url: nullableString,
  fb_url: nullableString,
  cb_url: nullableString,
  ycdc_url: nullableString,
  founders: z.array(ycFounderSchema).default([]),
});

const ycNewsItemSchema = z.object({
  title: z.string(),
  url: nullableString,
  date: nullableString,
});

const ycLaunchSchema = z.object({
  id: z.number(),
  title: z.string(),
  tagline: nullableString,
  body: nullableString,
  url: nullableString,
  ycdc_launch_url: nullableString,
  created_at: nullableString,
});

const ycCompanyPageSchema = z.object({
  props: z.object({
    company: ycCompanySchema,
    newsItems: z.array(ycNewsItemSchema).default([]),
    launches: z.array(ycLaunchSchema).default([]),
  }),
});

export type YcProfileSocialLink = {
  label: string;
  url: string;
};

export type YcProfileFounder = {
  fullName: string;
  title: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  bio: string | null;
};

export type YcProfileNewsItem = {
  title: string;
  date: string | null;
  url: string | null;
};

export type YcProfileLaunch = {
  title: string;
  publishedAt: string | null;
  url: string | null;
  ycLaunchUrl: string | null;
  tagline: string | null;
  body: string | null;
};

export type YcCompanyProfileSnapshot = {
  companyId: number;
  companyName: string;
  sourceUrl: string;
  socials: YcProfileSocialLink[];
  founders: YcProfileFounder[];
  newsItems: YcProfileNewsItem[];
  launches: YcProfileLaunch[];
  markdown: string;
};

function normalizeString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeUrl(value: string | null | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return normalized;
  }
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[entity] ?? match;
  });
}

function formatLink(url: string) {
  return `[${url}](${url})`;
}

function pushTextBlock(lines: string[], label: string, value: string | null) {
  if (!value) {
    lines.push(`- ${label}: None`);
    return;
  }

  lines.push(`- ${label}:`);
  lines.push(...value.split("\n").map((line) => `  ${line}`));
}

function splitSection(markdown: string, heading: string) {
  // Split the document into ## sections and look up by heading.
  // Earlier versions tried to use `(?=^## |\\Z)` as an anchor, but JavaScript
  // regex treats `\Z` as the literal character `Z` — so any `Z` in section
  // content (e.g. "Zurich" in a founder bio) truncated the capture.
  const prefix = `## ${heading}\n`;
  const sections = markdown.split(/\n(?=## [^#])/);
  for (const section of sections) {
    if (section.startsWith(prefix)) {
      return section.slice(prefix.length).trim();
    }
  }
  return "";
}

function parseSimpleField(line: string, label: string) {
  const prefix = `- ${label}:`;
  if (!line.startsWith(prefix)) {
    return null;
  }
  return line.slice(prefix.length).trim() || null;
}

function parseLinkField(line: string, label: string) {
  const rawValue = parseSimpleField(line, label);
  if (!rawValue || rawValue === "None") {
    return null;
  }

  const linkMatch = rawValue.match(/\((https?:\/\/[^\s)]+)\)\s*$/);
  if (linkMatch?.[1]) {
    return linkMatch[1];
  }

  return rawValue;
}

function parseIndentedField(lines: string[], startIndex: number, label: string) {
  const prefix = `- ${label}:`;
  if (lines[startIndex] !== prefix) {
    return { value: null, nextIndex: startIndex };
  }

  const blockLines: string[] = [];
  let index = startIndex + 1;
  while (index < lines.length && (lines[index].startsWith("  ") || lines[index] === "")) {
    blockLines.push(lines[index].replace(/^  /, ""));
    index += 1;
  }

  const value = blockLines.join("\n").trim();
  return { value: value || null, nextIndex: index };
}

export async function fetchYcCompanyProfileSnapshot(
  profileUrl: string,
  options?: { timeoutMs?: number },
): Promise<YcCompanyProfileSnapshot> {
  const timeoutMs = options?.timeoutMs ?? getYcProfileFetchTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(profileUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; yc_search/1.0; +https://www.ycombinator.com)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`YC profile fetch timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch YC company page (${response.status})`);
  }

  const html = await response.text();
  const dataPageMatch = html.match(/data-page="([^"]+)"/);
  if (!dataPageMatch?.[1]) {
    throw new Error("Could not locate YC company page payload.");
  }

  const decodedPayload = decodeHtmlEntities(dataPageMatch[1]);
  const parsed = ycCompanyPageSchema.parse(JSON.parse(decodedPayload));
  const { company, newsItems, launches } = parsed.props;

  const socials: YcProfileSocialLink[] = [
    { label: "LinkedIn", url: normalizeUrl(company.linkedin_url) ?? "" },
    { label: "X", url: normalizeUrl(company.twitter_url) ?? "" },
    { label: "GitHub", url: normalizeUrl(company.github_url) ?? "" },
    { label: "Facebook", url: normalizeUrl(company.fb_url) ?? "" },
    { label: "Crunchbase", url: normalizeUrl(company.cb_url) ?? "" },
  ].filter((item) => item.url);

  const founders = company.founders
    .filter((founder) => founder.is_active)
    .map<YcProfileFounder>((founder) => ({
      fullName: founder.full_name,
      title: founder.title,
      linkedinUrl: normalizeUrl(founder.linkedin_url),
      twitterUrl: normalizeUrl(founder.twitter_url),
      bio: founder.founder_bio,
    }));

  const normalizedNewsItems = newsItems.map<YcProfileNewsItem>((item) => ({
    title: item.title,
    date: item.date,
    url: normalizeUrl(item.url),
  }));

  const normalizedLaunches = launches.map<YcProfileLaunch>((launch) => ({
    title: launch.title,
    publishedAt: launch.created_at,
    url: normalizeUrl(launch.url),
    ycLaunchUrl: normalizeUrl(launch.ycdc_launch_url),
    tagline: launch.tagline,
    body: launch.body,
  }));

  const markdown = renderYcCompanyProfileSnapshotMarkdown({
    companyId: company.id,
    companyName: company.name,
    sourceUrl: normalizeUrl(profileUrl) ?? profileUrl,
    socials,
    founders,
    newsItems: normalizedNewsItems,
    launches: normalizedLaunches,
    markdown: "",
  });

  return {
    companyId: company.id,
    companyName: company.name,
    sourceUrl: normalizeUrl(profileUrl) ?? profileUrl,
    socials,
    founders,
    newsItems: normalizedNewsItems,
    launches: normalizedLaunches,
    markdown,
  };
}

export function renderYcCompanyProfileSnapshotMarkdown(snapshot: Omit<YcCompanyProfileSnapshot, "markdown"> | YcCompanyProfileSnapshot) {
  const lines = [
    "# YC profile snapshot",
    `Source URL: ${formatLink(snapshot.sourceUrl)}`,
    "",
    "## Company socials",
  ];

  if (snapshot.socials.length === 0) {
    lines.push("- None");
  } else {
    for (const social of snapshot.socials) {
      lines.push(`- ${social.label}: ${formatLink(social.url)}`);
    }
  }

  lines.push("", "## Active founders");
  if (snapshot.founders.length === 0) {
    lines.push("- None");
  } else {
    for (const founder of snapshot.founders) {
      lines.push(`### ${founder.fullName}`);
      lines.push(`- Title: ${founder.title ?? "None"}`);
      lines.push(`- LinkedIn: ${founder.linkedinUrl ? formatLink(founder.linkedinUrl) : "None"}`);
      lines.push(`- X: ${founder.twitterUrl ? formatLink(founder.twitterUrl) : "None"}`);
      pushTextBlock(lines, "Bio", founder.bio);
      lines.push("");
    }
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  lines.push("", "## Recent news");
  if (snapshot.newsItems.length === 0) {
    lines.push("- None");
  } else {
    for (const item of snapshot.newsItems) {
      lines.push(`### ${item.title}`);
      lines.push(`- Date: ${item.date ?? "None"}`);
      lines.push(`- URL: ${item.url ? formatLink(item.url) : "None"}`);
      lines.push("");
    }
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  lines.push("", "## Company launches");
  if (snapshot.launches.length === 0) {
    lines.push("- None");
  } else {
    for (const launch of snapshot.launches) {
      lines.push(`### ${launch.title}`);
      lines.push(`- Published: ${launch.publishedAt ?? "None"}`);
      lines.push(`- URL: ${launch.url ? formatLink(launch.url) : "None"}`);
      lines.push(`- YC URL: ${launch.ycLaunchUrl ? formatLink(launch.ycLaunchUrl) : "None"}`);
      lines.push(`- Tagline: ${launch.tagline ?? "None"}`);
      pushTextBlock(lines, "Body", launch.body);
      lines.push("");
    }
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  return lines.join("\n").trim();
}

export function parseYcCompanyProfileSnapshotMarkdown(markdown: string) {
  const socialsSection = splitSection(markdown, "Company socials");
  const foundersSection = splitSection(markdown, "Active founders");
  const newsSection = splitSection(markdown, "Recent news");
  const launchesSection = splitSection(markdown, "Company launches");

  const socials = socialsSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && line !== "- None")
    .map((line) => {
      const match = line.match(/^- ([^:]+): (.+)$/);
      if (!match) {
        return null;
      }
      const url = parseLinkField(line, match[1]);
      return url ? { label: match[1], url } : null;
    })
    .filter((item): item is YcProfileSocialLink => Boolean(item));

  const founders = foundersSection.trim() === "- None" || !foundersSection
    ? []
    : foundersSection
      .split(/^### /m)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map<YcProfileFounder>((chunk) => {
        const lines = chunk.split("\n");
        const fullName = lines[0]?.trim() ?? "";
        let title: string | null = null;
        let linkedinUrl: string | null = null;
        let twitterUrl: string | null = null;
        let bio: string | null = null;

        for (let index = 1; index < lines.length; index += 1) {
          const line = lines[index];
          if (line.startsWith("- Title:")) {
            const value = parseSimpleField(line, "Title");
            title = value && value !== "None" ? value : null;
          } else if (line.startsWith("- LinkedIn:")) {
            linkedinUrl = parseLinkField(line, "LinkedIn");
          } else if (line.startsWith("- X:")) {
            twitterUrl = parseLinkField(line, "X");
          } else if (line === "- Bio:") {
            const parsedBio = parseIndentedField(lines, index, "Bio");
            bio = parsedBio.value;
            index = parsedBio.nextIndex - 1;
          }
        }

        return { fullName, title, linkedinUrl, twitterUrl, bio };
      });

  const newsItems = newsSection.trim() === "- None" || !newsSection
    ? []
    : newsSection
      .split(/^### /m)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map<YcProfileNewsItem>((chunk) => {
        const lines = chunk.split("\n");
        return {
          title: lines[0]?.trim() ?? "",
          date: (() => {
            const value = lines.slice(1).map((line) => parseSimpleField(line, "Date")).find(Boolean) ?? null;
            return value && value !== "None" ? value : null;
          })(),
          url: lines.slice(1).map((line) => parseLinkField(line, "URL")).find(Boolean) ?? null,
        };
      });

  const launches = launchesSection.trim() === "- None" || !launchesSection
    ? []
    : launchesSection
      .split(/^### /m)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map<YcProfileLaunch>((chunk) => {
        const lines = chunk.split("\n");
        const title = lines[0]?.trim() ?? "";
        let publishedAt: string | null = null;
        let url: string | null = null;
        let ycLaunchUrl: string | null = null;
        let tagline: string | null = null;
        let body: string | null = null;

        for (let index = 1; index < lines.length; index += 1) {
          const line = lines[index];
          if (line.startsWith("- Published:")) {
            const value = parseSimpleField(line, "Published");
            publishedAt = value && value !== "None" ? value : null;
          } else if (line.startsWith("- URL:")) {
            url = parseLinkField(line, "URL");
          } else if (line.startsWith("- YC URL:")) {
            ycLaunchUrl = parseLinkField(line, "YC URL");
          } else if (line.startsWith("- Tagline:")) {
            const value = parseSimpleField(line, "Tagline");
            tagline = value && value !== "None" ? value : null;
          } else if (line === "- Body:") {
            const parsedBody = parseIndentedField(lines, index, "Body");
            body = parsedBody.value;
            index = parsedBody.nextIndex - 1;
          }
        }

        return { title, publishedAt, url, ycLaunchUrl, tagline, body };
      });

  return {
    socials,
    founders,
    newsItems,
    launches,
  };
}
