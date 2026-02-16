import { getDb, parseJsonArray } from "./db";

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
  content_markdown_firecrawl: string | null;
  website_url_firecrawl: string | null;
  scraped_at_firecrawl: string | null;
  scrape_error_firecrawl: string | null;
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
  vector: string;
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

export function getCompanyDetail(companyId: number) {
  const db = getDb();
  const row = db
    .prepare<[{ id: number }], CompanyDetailRow>(`
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
        COALESCE(s_crawl4ai.content_markdown, s_firecrawl.content_markdown) AS content_markdown,
        COALESCE(s_crawl4ai.website_url, s_firecrawl.website_url) AS website_url,
        COALESCE(s_crawl4ai.scraped_at, s_firecrawl.scraped_at) AS scraped_at,
        COALESCE(s_crawl4ai.error, s_firecrawl.error) AS scrape_error,
        s_crawl4ai.content_markdown AS content_markdown_crawl4ai,
        s_crawl4ai.website_url AS website_url_crawl4ai,
        s_crawl4ai.scraped_at AS scraped_at_crawl4ai,
        s_crawl4ai.error AS scrape_error_crawl4ai,
        s_firecrawl.content_markdown AS content_markdown_firecrawl,
        s_firecrawl.website_url AS website_url_firecrawl,
        s_firecrawl.scraped_at AS scraped_at_firecrawl,
        s_firecrawl.error AS scrape_error_firecrawl,
        e.vector
      FROM companies c
      LEFT JOIN website_snapshots s_crawl4ai
        ON s_crawl4ai.company_id = c.id AND s_crawl4ai.source = 'crawl4ai'
      LEFT JOIN website_snapshots s_firecrawl
        ON s_firecrawl.company_id = c.id AND s_firecrawl.source = 'firecrawl'
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id = @id
      LIMIT 1
    `)
    .get({ id: companyId });

  if (!row) {
    return null;
  }

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
  };
}

export function getSimilarCompanies(companyId: number, limit = 8) {
  const db = getDb();
  const target = db
    .prepare<[{ id: number }], { vector: string | null }>(
      "SELECT vector FROM company_embeddings WHERE company_id = @id",
    )
    .get({ id: companyId });

  if (!target?.vector) {
    return [];
  }

  const targetVector = JSON.parse(target.vector) as number[];
  const candidates = db
    .prepare<[{ id: number }], SimilarCandidateRow>(`
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
        e.vector
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id != @id
    `)
    .all({ id: companyId });

  return candidates
    .map((candidate) => ({
      ...candidate,
      similarity: cosineSimilarity(targetVector, JSON.parse(candidate.vector) as number[]),
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
