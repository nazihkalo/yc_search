import { isPgVectorReady, parseJsonArray, query, queryOne } from "./db";
import { parseVectorString } from "./vector-utils";
import { parseYcCompanyProfileSnapshotMarkdown } from "./yc-company-page";

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
  };
}

export async function getSimilarCompanies(companyId: number, limit = 8) {
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
