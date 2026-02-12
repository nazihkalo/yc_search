import { getDb, parseJsonArray } from "./db";
import { EMBEDDING_MODEL, getOpenAiClient } from "./openai";
import type { CompanyRecord } from "./types";

export type SearchFilters = {
  tags: string[];
  industries: string[];
  years: number[];
  stages: string[];
  regions: string[];
  isHiring?: boolean;
  nonprofit?: boolean;
  topCompany?: boolean;
};

export type SearchParams = {
  query: string;
  page: number;
  pageSize: number;
  sort: "relevance" | "newest" | "team_size" | "name";
  filters: SearchFilters;
};

type SearchResultRow = CompanyRecord;

function buildFilterWhereClause(
  filters: SearchFilters,
  params: Record<string, string | number>,
  fragments: string[],
) {
  if (filters.isHiring) {
    fragments.push("c.is_hiring = 1");
  }
  if (filters.nonprofit) {
    fragments.push("c.nonprofit = 1");
  }
  if (filters.topCompany) {
    fragments.push("c.top_company = 1");
  }

  if (filters.years.length > 0) {
    const yearClauses: string[] = [];
    filters.years.forEach((year, index) => {
      const key = `year_${index}`;
      params[key] = year;
      yearClauses.push(`CAST(strftime('%Y', c.launched_at, 'unixepoch') AS INTEGER) = @${key}`);
    });
    fragments.push(`(${yearClauses.join(" OR ")})`);
  }

  if (filters.tags.length > 0) {
    const tagClauses: string[] = [];
    filters.tags.forEach((tag, index) => {
      const key = `tag_${index}`;
      params[key] = tag;
      tagClauses.push(`EXISTS (SELECT 1 FROM json_each(c.tags) t WHERE t.value = @${key})`);
    });
    fragments.push(`(${tagClauses.join(" OR ")})`);
  }

  if (filters.industries.length > 0) {
    const industrySubqueries: string[] = [];
    filters.industries.forEach((industry, index) => {
      const key = `industry_${index}`;
      params[key] = industry;
      industrySubqueries.push(`
        c.industry = @${key}
        OR EXISTS (SELECT 1 FROM json_each(c.industries) i WHERE i.value = @${key})
      `);
    });
    fragments.push(`(${industrySubqueries.join(" OR ")})`);
  }

  if (filters.stages.length > 0) {
    const placeholders = filters.stages.map((_, index) => `@stage_${index}`);
    filters.stages.forEach((stage, index) => {
      params[`stage_${index}`] = stage;
    });
    fragments.push(`c.stage IN (${placeholders.join(", ")})`);
  }

  if (filters.regions.length > 0) {
    const regionClauses: string[] = [];
    filters.regions.forEach((region, index) => {
      const key = `region_${index}`;
      params[key] = region;
      regionClauses.push(`EXISTS (SELECT 1 FROM json_each(c.regions) r WHERE r.value = @${key})`);
    });
    fragments.push(`(${regionClauses.join(" OR ")})`);
  }
}

function buildSortClause(sort: SearchParams["sort"], query: string) {
  if (sort === "newest") {
    return "ORDER BY c.launched_at DESC NULLS LAST, c.top_company DESC, c.name ASC";
  }
  if (sort === "team_size") {
    return "ORDER BY c.team_size DESC NULLS LAST, c.top_company DESC, c.name ASC";
  }
  if (sort === "name") {
    return "ORDER BY c.name ASC";
  }
  if (query.trim().length > 0) {
    return "ORDER BY c.top_company DESC, c.team_size DESC NULLS LAST, c.name ASC";
  }
  return "ORDER BY c.top_company DESC, c.name ASC";
}

function hydrateResultRows(rows: SearchResultRow[]) {
  return rows.map((row) => ({
    ...row,
    tags: parseJsonArray(row.tags),
    industries: parseJsonArray(row.industries),
    regions: parseJsonArray(row.regions),
    is_hiring: Boolean(row.is_hiring),
    nonprofit: Boolean(row.nonprofit),
    top_company: Boolean(row.top_company),
    launched_year: row.launched_at ? new Date(row.launched_at * 1000).getUTCFullYear() : null,
  }));
}

export function keywordSearch(params: SearchParams) {
  const db = getDb();
  const query = params.query.trim();
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};

  if (query.length > 0) {
    queryParams.query = `%${query.toLowerCase()}%`;
    whereClauses.push(`
      (
        LOWER(c.name) LIKE @query
        OR LOWER(c.one_liner) LIKE @query
        OR LOWER(c.long_description) LIKE @query
        OR LOWER(c.search_text) LIKE @query
      )
    `);
  }

  buildFilterWhereClause(params.filters, queryParams, whereClauses);
  const whereSql = whereClauses.join(" AND ");
  const offset = (params.page - 1) * params.pageSize;
  queryParams.limit = params.pageSize;
  queryParams.offset = offset;

  const countRow = db
    .prepare<[{ [key: string]: string | number }], { total: number }>(`
      SELECT COUNT(*) AS total
      FROM companies c
      WHERE ${whereSql}
    `)
    .get(queryParams);

  const rows = db
    .prepare<[{ [key: string]: string | number }], SearchResultRow>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.website,
        c.one_liner,
        c.long_description,
        c.batch,
        c.stage,
        c.industry,
        c.all_locations,
        c.launched_at,
        c.team_size,
        c.is_hiring,
        c.nonprofit,
        c.top_company,
        c.tags,
        c.industries,
        c.regions,
        c.url,
        c.small_logo_thumb_url,
        c.status
      FROM companies c
      WHERE ${whereSql}
      ${buildSortClause(params.sort, query)}
      LIMIT @limit OFFSET @offset
    `)
    .all(queryParams);

  return {
    total: countRow?.total ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(rows),
  };
}

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

export async function semanticSearch(params: SearchParams) {
  const db = getDb();
  const query = params.query.trim();
  if (!query) {
    return {
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
      results: [],
    };
  }

  const openai = getOpenAiClient();
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });
  const queryVector = embeddingResponse.data[0]?.embedding ?? [];

  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);

  const rows = db
    .prepare<[{ [key: string]: string | number }], SearchResultRow & { vector: string }>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.website,
        c.one_liner,
        c.long_description,
        c.batch,
        c.stage,
        c.industry,
        c.all_locations,
        c.launched_at,
        c.team_size,
        c.is_hiring,
        c.nonprofit,
        c.top_company,
        c.tags,
        c.industries,
        c.regions,
        c.url,
        c.small_logo_thumb_url,
        c.status,
        e.vector
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereClauses.join(" AND ")}
    `)
    .all(queryParams);

  const scored = rows
    .map((row: SearchResultRow & { vector: string }) => {
      const vector = JSON.parse(row.vector) as number[];
      const score = cosineSimilarity(queryVector, vector);
      return {
        ...row,
        score,
      };
    })
    .sort(
      (
        left: SearchResultRow & { vector: string; score: number },
        right: SearchResultRow & { vector: string; score: number },
      ) => right.score - left.score,
    );

  const start = (params.page - 1) * params.pageSize;
  const paged = scored.slice(start, start + params.pageSize);

  return {
    total: scored.length,
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(paged).map((row, index) => ({
      ...row,
      score: Number(paged[index]?.score.toFixed(4) ?? 0),
    })),
  };
}

export function getFacets() {
  const db = getDb();

  const companies = db
    .prepare<[], { tags: string; industries: string; regions: string; stage: string | null; launched_at: number | null }>(`
      SELECT tags, industries, regions, stage, launched_at
      FROM companies
    `)
    .all();

  const tagCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const stageCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  for (const company of companies) {
    for (const tag of parseJsonArray(company.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    for (const industry of parseJsonArray(company.industries)) {
      industryCounts.set(industry, (industryCounts.get(industry) ?? 0) + 1);
    }
    for (const region of parseJsonArray(company.regions)) {
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
    if (company.stage) {
      stageCounts.set(company.stage, (stageCounts.get(company.stage) ?? 0) + 1);
    }
    if (company.launched_at) {
      const year = new Date(company.launched_at * 1000).getUTCFullYear();
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    }
  }

  const formatFacet = <T extends string | number>(counts: Map<T, number>) =>
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([value, count]) => ({ value, count }));

  return {
    tags: formatFacet(tagCounts),
    industries: formatFacet(industryCounts),
    regions: formatFacet(regionCounts),
    stages: formatFacet(stageCounts),
    years: formatFacet(yearCounts).sort((left, right) => Number(right.value) - Number(left.value)),
  };
}
