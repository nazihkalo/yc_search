import { initializeDatabase, query, queryOne, parseJsonArray } from "./db";
import { buildCompanyLinks } from "./company-links";
import { semanticSearch, type SearchFilters } from "./search";
import { extractDescriptionFromMarkdown } from "./snapshot-utils";
import { WEBSITE_SNAPSHOT_SOURCE, YC_PROFILE_SNAPSHOT_SOURCE } from "./snapshot-source";

const KB_SNIPPET_CHARS = 700;
const KB_DEFAULT_TOP_K = 6;
const KB_MAX_TOP_K = 10;

export type KnowledgeBaseFilters = Partial<SearchFilters>;

export type KnowledgeBaseResult = {
  id: number;
  name: string;
  slug: string | null;
  batch: string | null;
  industry: string | null;
  oneLiner: string | null;
  websiteUrl: string | null;
  companyPage: string;
  ycProfileUrl: string | null;
  logoUrl: string | null;
  snippet: string;
  score: number;
};

export type AskKnowledgeBaseInput = {
  query: string;
  filters?: KnowledgeBaseFilters;
  topK?: number;
};

export type AskKnowledgeBaseOutput = {
  query: string;
  totalCandidates: number;
  results: KnowledgeBaseResult[];
};

function normalizeFilters(filters?: KnowledgeBaseFilters): SearchFilters {
  return {
    tags: filters?.tags ?? [],
    industries: filters?.industries ?? [],
    batches: filters?.batches ?? [],
    years: filters?.years ?? [],
    stages: filters?.stages ?? [],
    regions: filters?.regions ?? [],
    isHiring: filters?.isHiring,
    nonprofit: filters?.nonprofit,
    topCompany: filters?.topCompany,
  };
}

export async function askKnowledgeBase(
  input: AskKnowledgeBaseInput,
): Promise<AskKnowledgeBaseOutput> {
  await initializeDatabase();
  const cleanQuery = input.query.trim();
  if (!cleanQuery) {
    return { query: "", totalCandidates: 0, results: [] };
  }

  const topK = Math.min(KB_MAX_TOP_K, Math.max(1, input.topK ?? KB_DEFAULT_TOP_K));
  const semantic = await semanticSearch({
    query: cleanQuery,
    page: 1,
    pageSize: topK,
    sort: "relevance",
    filters: normalizeFilters(input.filters),
  });

  if (semantic.results.length === 0) {
    return { query: cleanQuery, totalCandidates: 0, results: [] };
  }

  const ids = semantic.results.map((row) => row.id);
  const placeholders = ids.map((_, index) => `@id_${index}`);
  const idParams: Record<string, number> = {};
  ids.forEach((id, index) => {
    idParams[`id_${index}`] = id;
  });

  const snapshotRows = await query<{
    id: number;
    content_markdown: string | null;
  }>(
    `
      SELECT
        c.id,
        CONCAT_WS(
          E'\\n\\n',
          NULLIF(s_crawl4ai.content_markdown, ''),
          NULLIF(s_yc_profile.content_markdown, '')
        ) AS content_markdown
      FROM companies c
      LEFT JOIN website_snapshots s_crawl4ai
        ON s_crawl4ai.company_id = c.id AND s_crawl4ai.source = '${WEBSITE_SNAPSHOT_SOURCE}'
      LEFT JOIN website_snapshots s_yc_profile
        ON s_yc_profile.company_id = c.id AND s_yc_profile.source = '${YC_PROFILE_SNAPSHOT_SOURCE}'
      WHERE c.id IN (${placeholders.join(", ")})
    `,
    idParams,
  );

  const snippetById = new Map<number, string>();
  for (const row of snapshotRows) {
    if (!row.content_markdown) {
      snippetById.set(row.id, "");
      continue;
    }
    const extracted = extractDescriptionFromMarkdown(row.content_markdown);
    snippetById.set(row.id, extracted.slice(0, KB_SNIPPET_CHARS));
  }

  const results: KnowledgeBaseResult[] = semantic.results.map((row) => {
    const oneLiner = row.one_liner ?? "";
    const longDescription = row.long_description ?? "";
    const snapshotSnippet = snippetById.get(row.id) ?? "";
    const composed = [oneLiner, longDescription, snapshotSnippet]
      .filter(Boolean)
      .join(" | ")
      .slice(0, KB_SNIPPET_CHARS);
    const maybeScore = (row as unknown as { score?: number }).score;
    const score = typeof maybeScore === "number" ? maybeScore : 0;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      batch: row.batch,
      industry: row.industry,
      oneLiner: row.one_liner,
      websiteUrl: row.website,
      companyPage: `/companies/${row.id}`,
      ycProfileUrl: row.url,
      logoUrl: row.small_logo_thumb_url ?? null,
      snippet: composed,
      score,
    };
  });

  return {
    query: cleanQuery,
    totalCandidates: semantic.total,
    results,
  };
}

export type LookupCompanyInput = {
  idOrSlug: string | number;
};

export type LookupCompanyFounder = {
  name: string;
  title: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  avatarUrl: string | null;
};

export type LookupCompanyOutput = {
  id: number;
  name: string;
  slug: string | null;
  oneLiner: string | null;
  longDescription: string | null;
  batch: string | null;
  stage: string | null;
  industry: string | null;
  industries: string[];
  tags: string[];
  regions: string[];
  location: string | null;
  websiteUrl: string | null;
  ycProfileUrl: string | null;
  logoUrl: string | null;
  companyPage: string;
  isHiring: boolean;
  nonprofit: boolean;
  topCompany: boolean;
  teamSize: number | null;
  launchedYear: number | null;
  founders: LookupCompanyFounder[];
  topLinks: { url: string; label: string; kind: string }[];
} | null;

export async function lookupCompany(
  input: LookupCompanyInput,
): Promise<LookupCompanyOutput> {
  await initializeDatabase();

  const idOrSlug = input.idOrSlug;
  const isNumericId = typeof idOrSlug === "number" || /^\d+$/.test(String(idOrSlug));
  const params: Record<string, string | number> = {};
  let whereClause: string;
  if (isNumericId) {
    whereClause = "c.id = @id";
    params.id = Number(idOrSlug);
  } else {
    whereClause = "LOWER(c.slug) = LOWER(@slug)";
    params.slug = String(idOrSlug);
  }

  const company = await queryOne<{
    id: number;
    name: string;
    slug: string | null;
    one_liner: string | null;
    long_description: string | null;
    batch: string | null;
    stage: string | null;
    industry: string | null;
    industries: string;
    tags: string;
    regions: string;
    all_locations: string | null;
    website: string | null;
    url: string | null;
    small_logo_thumb_url: string | null;
    is_hiring: number | null;
    nonprofit: number | null;
    top_company: number | null;
    team_size: number | null;
    launched_at: number | null;
    content_markdown: string | null;
    website_url: string | null;
  }>(
    `
      SELECT
        c.id, c.name, c.slug, c.one_liner, c.long_description, c.batch, c.stage, c.industry,
        c.industries, c.tags, c.regions, c.all_locations, c.website, c.url,
        c.small_logo_thumb_url,
        c.is_hiring, c.nonprofit, c.top_company, c.team_size, c.launched_at,
        CONCAT_WS(
          E'\\n\\n',
          NULLIF(s_crawl4ai.content_markdown, ''),
          NULLIF(s_yc_profile.content_markdown, '')
        ) AS content_markdown,
        COALESCE(s_crawl4ai.website_url, s_yc_profile.website_url) AS website_url
      FROM companies c
      LEFT JOIN website_snapshots s_crawl4ai
        ON s_crawl4ai.company_id = c.id AND s_crawl4ai.source = '${WEBSITE_SNAPSHOT_SOURCE}'
      LEFT JOIN website_snapshots s_yc_profile
        ON s_yc_profile.company_id = c.id AND s_yc_profile.source = '${YC_PROFILE_SNAPSHOT_SOURCE}'
      WHERE ${whereClause}
      LIMIT 1
    `,
    params,
  );

  if (!company) {
    return null;
  }

  const founders = await query<{
    full_name: string;
    title: string | null;
    bio: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    github_url: string | null;
    personal_site_url: string | null;
  }>(
    `
      SELECT full_name, title, bio, linkedin_url, twitter_url, github_url, personal_site_url
      FROM founders
      WHERE company_id = @company_id
      ORDER BY id ASC
      LIMIT 10
    `,
    { company_id: company.id },
  );

  const topLinks = buildCompanyLinks({
    website: company.website,
    ycUrl: company.url,
    snapshotWebsiteUrl: company.website_url,
    contentMarkdown: company.content_markdown,
  });

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    oneLiner: company.one_liner,
    longDescription: company.long_description,
    batch: company.batch,
    stage: company.stage,
    industry: company.industry,
    industries: parseJsonArray(company.industries),
    tags: parseJsonArray(company.tags),
    regions: parseJsonArray(company.regions),
    location: company.all_locations,
    websiteUrl: company.website,
    ycProfileUrl: company.url,
    logoUrl: company.small_logo_thumb_url ?? null,
    companyPage: `/companies/${company.id}`,
    isHiring: Boolean(company.is_hiring),
    nonprofit: Boolean(company.nonprofit),
    topCompany: Boolean(company.top_company),
    teamSize: company.team_size,
    launchedYear: company.launched_at
      ? new Date(company.launched_at * 1000).getUTCFullYear()
      : null,
    founders: founders.map((row) => ({
      name: row.full_name,
      title: row.title,
      bio: row.bio,
      linkedinUrl: row.linkedin_url,
      twitterUrl: row.twitter_url,
      githubUrl: row.github_url,
      personalSiteUrl: row.personal_site_url,
      avatarUrl: githubAvatarFromUrl(row.github_url),
    })),
    topLinks: topLinks.map((link) => ({
      url: link.url,
      label: link.label,
      kind: link.kind,
    })),
  };
}

function githubAvatarFromUrl(githubUrl: string | null): string | null {
  if (!githubUrl) return null;
  const match = githubUrl.match(/github\.com\/([^/?#]+)/i);
  if (!match) return null;
  const username = match[1].trim();
  if (!username || username === "orgs" || username.includes("/")) return null;
  return `https://github.com/${username}.png?size=160`;
}

export type FindFoundersInput = {
  query: string;
  topK?: number;
  filters?: KnowledgeBaseFilters;
};

export type FoundersFounder = {
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  companyId: number;
  companyName: string;
  companySlug: string | null;
  companyBatch: string | null;
  companyOneLiner: string | null;
  companyLogoUrl: string | null;
  companyPage: string;
};

export type FindFoundersOutput = {
  query: string;
  totalCompanies: number;
  founders: FoundersFounder[];
};

export async function findFounders(input: FindFoundersInput): Promise<FindFoundersOutput> {
  await initializeDatabase();
  const cleanQuery = input.query.trim();
  if (!cleanQuery) {
    return { query: "", totalCompanies: 0, founders: [] };
  }

  const topK = Math.min(KB_MAX_TOP_K, Math.max(1, input.topK ?? 6));
  const semantic = await semanticSearch({
    query: cleanQuery,
    page: 1,
    pageSize: topK,
    sort: "relevance",
    filters: normalizeFilters(input.filters),
  });

  if (semantic.results.length === 0) {
    return { query: cleanQuery, totalCompanies: 0, founders: [] };
  }

  const ids = semantic.results.map((row) => row.id);
  const placeholders = ids.map((_, index) => `@id_${index}`);
  const idParams: Record<string, number> = {};
  ids.forEach((id, index) => {
    idParams[`id_${index}`] = id;
  });

  const founderRows = await query<{
    company_id: number;
    full_name: string;
    title: string | null;
    bio: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    github_url: string | null;
    personal_site_url: string | null;
  }>(
    `
      SELECT
        f.company_id, f.full_name, f.title, f.bio,
        f.linkedin_url, f.twitter_url, f.github_url, f.personal_site_url
      FROM founders f
      WHERE f.company_id IN (${placeholders.join(", ")})
      ORDER BY f.company_id, f.id
    `,
    idParams,
  );

  const companyById = new Map(semantic.results.map((row) => [row.id, row]));
  const founders: FoundersFounder[] = [];
  for (const row of founderRows) {
    const company = companyById.get(row.company_id);
    if (!company) continue;
    founders.push({
      name: row.full_name,
      title: row.title,
      bio: row.bio,
      avatarUrl: githubAvatarFromUrl(row.github_url),
      linkedinUrl: row.linkedin_url,
      twitterUrl: row.twitter_url,
      githubUrl: row.github_url,
      personalSiteUrl: row.personal_site_url,
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      companyBatch: company.batch,
      companyOneLiner: company.one_liner,
      companyLogoUrl: company.small_logo_thumb_url ?? null,
      companyPage: `/companies/${company.id}`,
    });
  }

  return {
    query: cleanQuery,
    totalCompanies: semantic.results.length,
    founders,
  };
}
