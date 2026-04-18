import { unstable_cache } from "next/cache";

import { isPgVectorReady, parseJsonArray, query, queryOne } from "./db";
import { parseVectorString } from "./vector-utils";
import { parseYcCompanyProfileSnapshotMarkdown } from "./yc-company-page";

export type FounderGithubSummary = {
  username: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number | null;
  followers: number | null;
  following: number | null;
  topLanguages: Array<{ language: string; count: number }>;
  topRepos: Array<{ name: string; url: string; description: string | null; stars: number; language: string | null }>;
  fetchedAt: string | null;
  error: string | null;
};

export type FounderMentionSummary = {
  url: string;
  title: string | null;
  excerpt: string | null;
  kind: string;
  publishedAt: string | null;
};

export type FounderSiteSnapshotSummary = {
  url: string;
  source: string;
  contentMarkdown: string | null;
  scrapedAt: string | null;
  error: string | null;
};

export type FounderBackgroundSummary = {
  summary: string | null;
  previousCompanies: Array<{ name: string; role?: string | null; years?: string | null }>;
  education: Array<{ school: string; degree?: string | null; field?: string | null }>;
  notableActivities: string[];
};

export type EnrichedFounder = {
  id: number;
  fullName: string;
  title: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  wikipediaUrl: string | null;
  background: FounderBackgroundSummary | null;
  github: FounderGithubSummary | null;
  mentions: FounderMentionSummary[];
  siteSnapshot: FounderSiteSnapshotSummary | null;
};

type FounderJoinRow = {
  id: number;
  full_name: string;
  title: string | null;
  bio: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  personal_site_url: string | null;
  wikipedia_url: string | null;
  background: unknown;
  github_username: string | null;
  github_name: string | null;
  github_bio: string | null;
  github_company: string | null;
  github_location: string | null;
  github_blog: string | null;
  public_repos: number | null;
  followers: number | null;
  following: number | null;
  top_languages: unknown;
  top_repos: unknown;
  github_fetched_at: string | null;
  github_error: string | null;
};

function parseBackground(raw: unknown): FounderBackgroundSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const prev = Array.isArray(record.previous_companies) ? record.previous_companies : [];
  const edu = Array.isArray(record.education) ? record.education : [];
  const acts = Array.isArray(record.notable_activities) ? record.notable_activities : [];
  return {
    summary: typeof record.summary === "string" ? record.summary : null,
    previousCompanies: prev
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as Record<string, unknown>;
        if (typeof e.name !== "string") return null;
        return {
          name: e.name,
          role: typeof e.role === "string" ? e.role : null,
          years: typeof e.years === "string" ? e.years : null,
        };
      })
      .filter((value): value is { name: string; role: string | null; years: string | null } => Boolean(value)),
    education: edu
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as Record<string, unknown>;
        if (typeof e.school !== "string") return null;
        return {
          school: e.school,
          degree: typeof e.degree === "string" ? e.degree : null,
          field: typeof e.field === "string" ? e.field : null,
        };
      })
      .filter((value): value is { school: string; degree: string | null; field: string | null } => Boolean(value)),
    notableActivities: acts.filter((value): value is string => typeof value === "string"),
  };
}

type FounderMentionRow = {
  founder_id: number;
  url: string;
  title: string | null;
  excerpt: string | null;
  kind: string;
  published_at: string | null;
};

type FounderSnapshotRow = {
  founder_id: number;
  url: string;
  source: string;
  content_markdown: string | null;
  scraped_at: string | null;
  error: string | null;
};

export async function getEnrichedFounders(companyId: number): Promise<EnrichedFounder[]> {
  const founderRows = await query<FounderJoinRow>(`
      SELECT
        f.id,
        f.full_name,
        f.title,
        f.bio,
        f.linkedin_url,
        f.twitter_url,
        f.github_url,
        f.personal_site_url,
        f.wikipedia_url,
        f.background,
        fg.github_username,
        fg.name AS github_name,
        fg.bio AS github_bio,
        fg.company AS github_company,
        fg.location AS github_location,
        fg.blog AS github_blog,
        fg.public_repos,
        fg.followers,
        fg.following,
        fg.top_languages,
        fg.top_repos,
        fg.fetched_at AS github_fetched_at,
        fg.error AS github_error
      FROM founders f
      LEFT JOIN founder_github fg ON fg.founder_id = f.id
      WHERE f.company_id = @company_id
      ORDER BY f.id ASC
    `, { company_id: companyId });

  if (founderRows.length === 0) {
    return [];
  }

  const founderIds = founderRows.map((row) => row.id);
  const idsLiteral = `{${founderIds.join(",")}}`;

  const [mentionRows, snapshotRows] = await Promise.all([
    query<FounderMentionRow>(`
      SELECT founder_id, url, title, excerpt, kind, published_at
      FROM founder_mentions
      WHERE founder_id = ANY(@ids::bigint[])
      ORDER BY discovered_at DESC
    `, { ids: idsLiteral }),
    query<FounderSnapshotRow>(`
      SELECT founder_id, url, source, content_markdown, scraped_at, error
      FROM founder_snapshots
      WHERE founder_id = ANY(@ids::bigint[])
        AND source = 'personal_site'
      ORDER BY scraped_at DESC
    `, { ids: idsLiteral }),
  ]);

  const mentionsByFounder = new Map<number, FounderMentionSummary[]>();
  for (const row of mentionRows) {
    const existing = mentionsByFounder.get(row.founder_id);
    const entry: FounderMentionSummary = {
      url: row.url,
      title: row.title,
      excerpt: row.excerpt,
      kind: row.kind,
      publishedAt: row.published_at,
    };
    if (existing) existing.push(entry);
    else mentionsByFounder.set(row.founder_id, [entry]);
  }

  const snapshotByFounder = new Map<number, FounderSiteSnapshotSummary>();
  for (const row of snapshotRows) {
    if (snapshotByFounder.has(row.founder_id)) continue;
    snapshotByFounder.set(row.founder_id, {
      url: row.url,
      source: row.source,
      contentMarkdown: row.content_markdown,
      scrapedAt: row.scraped_at,
      error: row.error,
    });
  }

  return founderRows.map<EnrichedFounder>((row) => {
    const github: FounderGithubSummary | null = row.github_username || row.github_error
      ? {
          username: row.github_username ?? "",
          name: row.github_name,
          bio: row.github_bio,
          company: row.github_company,
          location: row.github_location,
          blog: row.github_blog,
          publicRepos: row.public_repos,
          followers: row.followers,
          following: row.following,
          topLanguages: Array.isArray(row.top_languages) ? row.top_languages as FounderGithubSummary["topLanguages"] : [],
          topRepos: Array.isArray(row.top_repos) ? row.top_repos as FounderGithubSummary["topRepos"] : [],
          fetchedAt: row.github_fetched_at,
          error: row.github_error,
        }
      : null;

    return {
      id: row.id,
      fullName: row.full_name,
      title: row.title,
      bio: row.bio,
      linkedinUrl: row.linkedin_url,
      twitterUrl: row.twitter_url,
      githubUrl: row.github_url,
      personalSiteUrl: row.personal_site_url,
      wikipediaUrl: row.wikipedia_url,
      background: parseBackground(row.background),
      github,
      mentions: mentionsByFounder.get(row.id) ?? [],
      siteSnapshot: snapshotByFounder.get(row.id) ?? null,
    };
  });
}

type CompanyDetailRow = {
  id: number;
  name: string;
  slug: string | null;
  former_names: string;
  small_logo_thumb_url: string | null;
  website: string | null;
  all_locations: string | null;
  long_description: string | null;
  one_liner: string | null;
  team_size: number | null;
  highlight_black: number;
  highlight_latinx: number;
  highlight_women: number;
  industry: string | null;
  subindustry: string | null;
  launched_at: number | null;
  tags: string;
  top_company: number;
  is_hiring: number;
  nonprofit: number;
  batch: string | null;
  status: string | null;
  industries: string;
  regions: string;
  stage: string | null;
  app_video_public: number;
  demo_day_video_public: number;
  question_answers: number;
  url: string | null;
  api: string | null;
  search_text: string;
  content_markdown: string | null;
  website_url: string | null;
  scraped_at: string | null;
  scrape_error: string | null;
  content_markdown_crawl4ai: string | null;
  website_url_crawl4ai: string | null;
  scraped_at_crawl4ai: string | null;
  scrape_error_crawl4ai: string | null;
  content_markdown_yc_profile: string | null;
  website_url_yc_profile: string | null;
  scraped_at_yc_profile: string | null;
  scrape_error_yc_profile: string | null;
  vector: string | null;
};

type SimilarCandidateRow = {
  id: number;
  name: string;
  slug: string | null;
  one_liner: string | null;
  industry: string | null;
  batch: string | null;
  stage: string | null;
  small_logo_thumb_url: string | null;
  website: string | null;
  url: string | null;
  similarity: number;
};

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getCompanyDetail(companyId: number) {
  const row = await queryOne<CompanyDetailRow>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.former_names,
        c.small_logo_thumb_url,
        c.website,
        c.all_locations,
        c.long_description,
        c.one_liner,
        c.team_size,
        c.highlight_black,
        c.highlight_latinx,
        c.highlight_women,
        c.industry,
        c.subindustry,
        c.launched_at,
        c.tags,
        c.top_company,
        c.is_hiring,
        c.nonprofit,
        c.batch,
        c.status,
        c.industries,
        c.regions,
        c.stage,
        c.app_video_public,
        c.demo_day_video_public,
        c.question_answers,
        c.url,
        c.api,
        c.search_text,
        s_crawl4ai.content_markdown,
        s_crawl4ai.website_url,
        s_crawl4ai.scraped_at,
        s_crawl4ai.error AS scrape_error,
        s_crawl4ai.content_markdown AS content_markdown_crawl4ai,
        s_crawl4ai.website_url AS website_url_crawl4ai,
        s_crawl4ai.scraped_at AS scraped_at_crawl4ai,
        s_crawl4ai.error AS scrape_error_crawl4ai,
        s_yc_profile.content_markdown AS content_markdown_yc_profile,
        s_yc_profile.website_url AS website_url_yc_profile,
        s_yc_profile.scraped_at AS scraped_at_yc_profile,
        s_yc_profile.error AS scrape_error_yc_profile,
        e.vector
      FROM companies c
      LEFT JOIN website_snapshots s_crawl4ai
        ON s_crawl4ai.company_id = c.id AND s_crawl4ai.source = 'crawl4ai'
      LEFT JOIN website_snapshots s_yc_profile
        ON s_yc_profile.company_id = c.id AND s_yc_profile.source = 'yc_profile'
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id = @id
      LIMIT 1
    `, { id: companyId });

  if (!row) {
    return null;
  }

  const ycProfile = row.content_markdown_yc_profile
    ? parseYcCompanyProfileSnapshotMarkdown(row.content_markdown_yc_profile)
    : { socials: [], founders: [], newsItems: [], launches: [] };

  const enrichedFounders = await getEnrichedFounders(companyId);

  return {
    ...row,
    former_names: parseJsonArray(row.former_names),
    tags: parseJsonArray(row.tags),
    industries: parseJsonArray(row.industries),
    regions: parseJsonArray(row.regions),
    highlight_black: Boolean(row.highlight_black),
    highlight_latinx: Boolean(row.highlight_latinx),
    highlight_women: Boolean(row.highlight_women),
    top_company: Boolean(row.top_company),
    is_hiring: Boolean(row.is_hiring),
    nonprofit: Boolean(row.nonprofit),
    app_video_public: Boolean(row.app_video_public),
    demo_day_video_public: Boolean(row.demo_day_video_public),
    question_answers: Boolean(row.question_answers),
    launched_year: row.launched_at ? new Date(row.launched_at * 1000).getUTCFullYear() : null,
    yc_profile_socials: ycProfile.socials,
    yc_profile_founders: ycProfile.founders,
    yc_profile_news_items: ycProfile.newsItems,
    yc_profile_launches: ycProfile.launches,
    enriched_founders: enrichedFounders,
  };
}

async function getSimilarCompaniesUncached(companyId: number, limit = 8) {
  const target = await queryOne<{ vector: string | null }>(
    "SELECT vector FROM company_embeddings WHERE company_id = @id",
    { id: companyId },
  );

  if (!target?.vector) {
    return [];
  }

  if (!(await isPgVectorReady())) {
    const targetVector = parseVectorString(target.vector);
    const candidates = await query<SimilarCandidateRow & { vector: string }>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.one_liner,
        c.industry,
        c.batch,
        c.stage,
        c.small_logo_thumb_url,
        c.website,
        c.url,
        e.vector,
        0::float AS similarity
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id != @id
    `, { id: companyId });

    return candidates
      .map((candidate) => ({
        ...candidate,
        similarity: cosineSimilarity(targetVector, parseVectorString(candidate.vector)),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        slug: candidate.slug,
        one_liner: candidate.one_liner,
        industry: candidate.industry,
        batch: candidate.batch,
        stage: candidate.stage,
        small_logo_thumb_url: candidate.small_logo_thumb_url,
        website: candidate.website,
        url: candidate.url,
        similarity: Number(candidate.similarity.toFixed(4)),
      }));
  }

  const candidates = await query<SimilarCandidateRow>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.one_liner,
        c.industry,
        c.batch,
        c.stage,
        c.small_logo_thumb_url,
        c.website,
        c.url,
        1 - (e.vector <=> @target_vector::vector(1536)) AS similarity
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id != @id
      ORDER BY e.vector <=> @target_vector::vector(1536), c.top_company DESC, c.name ASC
      LIMIT @limit
    `, {
    id: companyId,
    target_vector: target.vector,
    limit,
  });

  return candidates
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      slug: candidate.slug,
      one_liner: candidate.one_liner,
      industry: candidate.industry,
      batch: candidate.batch,
      stage: candidate.stage,
      small_logo_thumb_url: candidate.small_logo_thumb_url,
      website: candidate.website,
      url: candidate.url,
      similarity: Number(candidate.similarity.toFixed(4)),
    }));
}

export const getSimilarCompanies = unstable_cache(
  getSimilarCompaniesUncached,
  ["similar-companies-v1"],
  { revalidate: 3600, tags: ["similar-companies"] },
);
