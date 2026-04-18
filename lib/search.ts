import { execute, isPgVectorReady, parseJsonArray, query, queryOne } from "./db";
import { EMBEDDING_MODEL, getOpenAiClient } from "./openai";
import { buildCompanyLinks } from "./company-links";
import { sha256 } from "./hash";
import { extractDescriptionFromMarkdown } from "./snapshot-utils";
import { WEBSITE_SNAPSHOT_SOURCE, YC_PROFILE_SNAPSHOT_SOURCE } from "./snapshot-source";
import type { CompanyRecord } from "./types";
import {
  EMBEDDING_DIMENSIONS,
  normalizeQueryEmbeddingInput,
  parseVectorString,
  toVectorLiteral,
} from "./vector-utils";

export type SearchFilters = {
  tags: string[];
  industries: string[];
  batches: string[];
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

type SearchResultRow = CompanyRecord & {
  content_markdown: string | null;
  website_url: string | null;
};
type AnalyticsCompanyRow = {
  id: number;
  batch: string | null;
  launched_at: number | null;
  tags: string;
  industries: string;
};

const COMBINED_SNAPSHOT_SELECT_SQL = `
  CONCAT_WS(
    E'\\n\\n',
    NULLIF(s_crawl4ai.content_markdown, ''),
    NULLIF(s_yc_profile.content_markdown, '')
  ) AS content_markdown,
  COALESCE(s_crawl4ai.website_url, s_yc_profile.website_url) AS website_url
`;

const COMBINED_SNAPSHOT_JOIN_SQL = `
  LEFT JOIN website_snapshots s_crawl4ai
    ON s_crawl4ai.company_id = c.id AND s_crawl4ai.source = '${WEBSITE_SNAPSHOT_SOURCE}'
  LEFT JOIN website_snapshots s_yc_profile
    ON s_yc_profile.company_id = c.id AND s_yc_profile.source = '${YC_PROFILE_SNAPSHOT_SOURCE}'
`;

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

  if (filters.batches.length > 0) {
    const placeholders = filters.batches.map((_, index) => `@batch_${index}`);
    filters.batches.forEach((batch, index) => {
      params[`batch_${index}`] = batch;
    });
    fragments.push(`c.batch IN (${placeholders.join(", ")})`);
  }

  if (filters.years.length > 0) {
    const yearClauses: string[] = [];
    filters.years.forEach((year, index) => {
      const key = `year_${index}`;
      params[key] = year;
      yearClauses.push(`EXTRACT(YEAR FROM TO_TIMESTAMP(c.launched_at))::INTEGER = @${key}`);
    });
    fragments.push(`(${yearClauses.join(" OR ")})`);
  }

  if (filters.tags.length > 0) {
    const tagClauses: string[] = [];
    filters.tags.forEach((tag, index) => {
      const key = `tag_${index}`;
      params[key] = tag;
      tagClauses.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(c.tags::json) AS t(value) WHERE t.value = @${key})`,
      );
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
        OR EXISTS (
          SELECT 1
          FROM json_array_elements_text(c.industries::json) AS i(value)
          WHERE i.value = @${key}
        )
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
      regionClauses.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(c.regions::json) AS r(value) WHERE r.value = @${key})`,
      );
    });
    fragments.push(`(${regionClauses.join(" OR ")})`);
  }
}

// Chronological ranking for YC batches. Handles both the modern "Spring 2026" form and
// the legacy compact form ("W21" / "S23" / "F24"). Unknown/null batches rank last (-1).
// Season order within a year: Winter (Jan–Mar) < Spring (Apr–Jun) < Summer (Jul–Sep) < Fall (Oct–Dec).
const BATCH_ORDER_EXPR = `
  CASE
    WHEN c.batch ~ '^(Winter|Spring|Summer|Fall)\\s+[0-9]{4}$' THEN
      (SUBSTRING(c.batch FROM '[0-9]{4}')::int) * 4
      + CASE SPLIT_PART(c.batch, ' ', 1)
          WHEN 'Winter' THEN 0
          WHEN 'Spring' THEN 1
          WHEN 'Summer' THEN 2
          WHEN 'Fall'   THEN 3
          ELSE -1
        END
    WHEN c.batch ~ '^[WSF][0-9]{2}$' THEN
      (2000 + SUBSTRING(c.batch FROM '[0-9]{2}')::int) * 4
      + CASE SUBSTRING(c.batch FROM 1 FOR 1)
          WHEN 'W' THEN 0
          WHEN 'S' THEN 2
          WHEN 'F' THEN 3
          ELSE -1
        END
    ELSE -1
  END
`;

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
    return `ORDER BY c.top_company DESC, ${BATCH_ORDER_EXPR} DESC NULLS LAST, c.team_size DESC NULLS LAST, c.name ASC`;
  }
  return `ORDER BY ${BATCH_ORDER_EXPR} DESC NULLS LAST, c.top_company DESC, c.name ASC`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function applyKeywordLikeParams(searchQuery: string, queryParams: Record<string, string | number>) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const escapedQuery = escapeLikePattern(normalizedQuery);
  queryParams.query_plain = normalizedQuery;
  queryParams.query_exact = normalizedQuery;
  queryParams.query_prefix = `${escapedQuery}%`;
  queryParams.query_contains = `%${escapedQuery}%`;
}

function buildKeywordScoreSql() {
  return `
    (
      CASE
        WHEN @query_plain = '' THEN 0
        ELSE
          CASE WHEN LOWER(c.name) = @query_exact THEN 1.05 ELSE 0 END
          + CASE WHEN LOWER(c.name) LIKE @query_prefix ESCAPE '\\' THEN 0.55 ELSE 0 END
          + CASE WHEN LOWER(c.name) LIKE @query_contains ESCAPE '\\' THEN 0.35 ELSE 0 END
          + CASE WHEN LOWER(COALESCE(c.one_liner, '')) LIKE @query_contains ESCAPE '\\' THEN 0.3 ELSE 0 END
          + CASE WHEN LOWER(COALESCE(c.industry, '')) LIKE @query_contains ESCAPE '\\' THEN 0.22 ELSE 0 END
          + CASE WHEN LOWER(COALESCE(c.long_description, '')) LIKE @query_contains ESCAPE '\\' THEN 0.14 ELSE 0 END
          + CASE WHEN LOWER(COALESCE(c.search_text, '')) LIKE @query_contains ESCAPE '\\' THEN 0.1 ELSE 0 END
      END
    )
  `;
}

function buildHybridSortClause(sort: SearchParams["sort"]) {
  if (sort === "newest") {
    return "ORDER BY c.launched_at DESC NULLS LAST, hybrid_score DESC, c.top_company DESC, c.name ASC";
  }
  if (sort === "team_size") {
    return "ORDER BY c.team_size DESC NULLS LAST, hybrid_score DESC, c.top_company DESC, c.name ASC";
  }
  if (sort === "name") {
    return "ORDER BY c.name ASC, hybrid_score DESC";
  }
  return `ORDER BY hybrid_score DESC, ${BATCH_ORDER_EXPR} DESC NULLS LAST, c.top_company DESC, c.team_size DESC NULLS LAST, c.name ASC`;
}

function computeKeywordScore(
  row: Pick<SearchResultRow, "name" | "one_liner" | "industry" | "long_description">,
  searchQuery: string,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const name = row.name.toLowerCase();
  const oneLiner = row.one_liner?.toLowerCase() ?? "";
  const industry = row.industry?.toLowerCase() ?? "";
  const description = row.long_description?.toLowerCase() ?? "";

  let score = 0;
  if (name === normalizedQuery) {
    score += 1.05;
  }
  if (name.startsWith(normalizedQuery)) {
    score += 0.55;
  }
  if (name.includes(normalizedQuery)) {
    score += 0.35;
  }
  if (oneLiner.includes(normalizedQuery)) {
    score += 0.3;
  }
  if (industry.includes(normalizedQuery)) {
    score += 0.22;
  }
  if (description.includes(normalizedQuery)) {
    score += 0.14;
  }

  return Math.min(score, 1.4);
}

function compareHybridRows(
  left: { name: string; launched_at: number | null; team_size: number | null; hybrid_score: number; top_company: boolean | number },
  right: { name: string; launched_at: number | null; team_size: number | null; hybrid_score: number; top_company: boolean | number },
  sort: SearchParams["sort"],
) {
  if (sort === "newest") {
    const launchedAtDifference =
      left.launched_at === right.launched_at ? 0 : (right.launched_at ?? Number.NEGATIVE_INFINITY) - (left.launched_at ?? Number.NEGATIVE_INFINITY);
    if (launchedAtDifference !== 0) {
      return launchedAtDifference;
    }
  } else if (sort === "team_size") {
    const teamSizeDifference =
      left.team_size === right.team_size ? 0 : (right.team_size ?? Number.NEGATIVE_INFINITY) - (left.team_size ?? Number.NEGATIVE_INFINITY);
    if (teamSizeDifference !== 0) {
      return teamSizeDifference;
    }
  } else if (sort === "name") {
    const nameDifference = left.name.localeCompare(right.name);
    if (nameDifference !== 0) {
      return nameDifference;
    }
  } else {
    const relevanceDifference = right.hybrid_score - left.hybrid_score;
    if (relevanceDifference !== 0) {
      return relevanceDifference;
    }
  }

  const hybridDifference = right.hybrid_score - left.hybrid_score;
  if (hybridDifference !== 0) {
    return hybridDifference;
  }

  const leftTopCompany = Number(Boolean(left.top_company));
  const rightTopCompany = Number(Boolean(right.top_company));
  if (leftTopCompany !== rightTopCompany) {
    return rightTopCompany - leftTopCompany;
  }

  return left.name.localeCompare(right.name);
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
    top_links: buildCompanyLinks({
      website: row.website,
      ycUrl: row.url,
      snapshotWebsiteUrl: row.website_url,
      contentMarkdown: row.content_markdown,
    }),
  }));
}

export async function keywordSearch(params: SearchParams) {
  const searchQuery = params.query.trim();
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};

  if (searchQuery.length > 0) {
    queryParams.query = `%${searchQuery.toLowerCase()}%`;
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

  const countRow = await queryOne<{ total: string | number }>(`
      SELECT COUNT(*) AS total
      FROM companies c
      WHERE ${whereSql}
    `, queryParams);

  const rows = await query<SearchResultRow>(`
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
        ${COMBINED_SNAPSHOT_SELECT_SQL}
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      WHERE ${whereSql}
      ${buildSortClause(params.sort, searchQuery)}
      LIMIT @limit OFFSET @offset
    `, queryParams);

  return {
    total: Number(countRow?.total ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(rows),
  };
}

function buildKeywordAndFilterSql(params: SearchParams) {
  const searchQuery = params.query.trim();
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};

  if (searchQuery.length > 0) {
    queryParams.query = `%${searchQuery.toLowerCase()}%`;
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
  return {
    whereSql: whereClauses.join(" AND "),
    queryParams,
  };
}

function buildFilterOnlySql(filters: SearchFilters) {
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(filters, queryParams, whereClauses);
  return {
    whereSql: whereClauses.join(" AND "),
    queryParams,
  };
}

function buildSemanticSortClause(sort: SearchParams["sort"]) {
  if (sort === "newest") {
    return "ORDER BY e.vector <=> @query_vector::vector(1536), c.launched_at DESC NULLS LAST, c.top_company DESC, c.name ASC";
  }
  if (sort === "team_size") {
    return "ORDER BY e.vector <=> @query_vector::vector(1536), c.team_size DESC NULLS LAST, c.top_company DESC, c.name ASC";
  }
  if (sort === "name") {
    return "ORDER BY e.vector <=> @query_vector::vector(1536), c.name ASC";
  }
  return "ORDER BY e.vector <=> @query_vector::vector(1536), c.top_company DESC, c.team_size DESC NULLS LAST, c.name ASC";
}

async function getOrCreateQueryEmbedding(searchQuery: string) {
  const normalizedQuery = normalizeQueryEmbeddingInput(searchQuery);
  const queryHash = sha256(`${EMBEDDING_MODEL}:${normalizedQuery}`);
  const cached = await queryOne<{ vector: string }>(
    `
      SELECT vector
      FROM query_embeddings
      WHERE query_hash = @query_hash AND model = @model
      LIMIT 1
    `,
    {
      query_hash: queryHash,
      model: EMBEDDING_MODEL,
    },
  );

  if (cached?.vector) {
    return cached.vector;
  }

  const openai = getOpenAiClient();
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: searchQuery,
  });
  const queryVector = embeddingResponse.data[0]?.embedding ?? [];
  const vectorLiteral = toVectorLiteral(queryVector);

  await execute(
    `
      INSERT INTO query_embeddings (
        query_hash,
        query_text,
        model,
        dimensions,
        vector,
        created_at,
        updated_at
      ) VALUES (
        @query_hash,
        @query_text,
        @model,
        @dimensions,
        @vector,
        NOW(),
        NOW()
      )
      ON CONFLICT(query_hash) DO UPDATE SET
        query_text = EXCLUDED.query_text,
        model = EXCLUDED.model,
        dimensions = EXCLUDED.dimensions,
        vector = EXCLUDED.vector,
        updated_at = NOW()
    `,
    {
      query_hash: queryHash,
      query_text: normalizedQuery,
      model: EMBEDDING_MODEL,
      dimensions: queryVector.length || EMBEDDING_DIMENSIONS,
      vector: vectorLiteral,
    },
  );

  return vectorLiteral;
}

async function semanticSearchLegacy(params: SearchParams, queryVectorLiteral: string) {
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);

  const rows = await query<SearchResultRow & { vector: string }>(`
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
        ${COMBINED_SNAPSHOT_SELECT_SQL},
        e.vector
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereClauses.join(" AND ")}
    `, queryParams);

  const queryVector = parseVectorString(queryVectorLiteral);
  const scored = rows
    .map((row) => {
      const vector = parseVectorString(row.vector);
      if (vector.length !== queryVector.length || vector.length === 0) {
        return { ...row, score: 0 };
      }

      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vector.length; i += 1) {
        dot += queryVector[i] * vector[i];
        normA += queryVector[i] * queryVector[i];
        normB += vector[i] * vector[i];
      }

      const score = !normA || !normB ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
      return { ...row, score };
    })
    .sort((left, right) => right.score - left.score);

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

async function hybridSearchLegacy(params: SearchParams, queryVectorLiteral: string) {
  const searchQuery = params.query.trim();
  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);

  const rows = await query<SearchResultRow & { vector: string | null }>(`
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
        ${COMBINED_SNAPSHOT_SELECT_SQL},
        e.vector
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereClauses.join(" AND ")}
    `, queryParams);

  const queryVector = parseVectorString(queryVectorLiteral);
  const scored = rows
    .map((row) => {
      const keywordScore = computeKeywordScore(row, searchQuery);
      const vector = row.vector ? parseVectorString(row.vector) : [];
      let semanticScore = 0;

      if (vector.length === queryVector.length && vector.length > 0) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vector.length; i += 1) {
          dot += queryVector[i] * vector[i];
          normA += queryVector[i] * queryVector[i];
          normB += vector[i] * vector[i];
        }
        semanticScore = !normA || !normB ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
      }

      const hybridScore = semanticScore * 0.72 + keywordScore * 0.45;
      return { ...row, hybrid_score: hybridScore };
    })
    .filter((row) => row.vector || row.hybrid_score > 0)
    .sort((left, right) => compareHybridRows(left, right, params.sort));

  const start = (params.page - 1) * params.pageSize;
  const paged = scored.slice(start, start + params.pageSize);

  return {
    total: scored.length,
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(paged).map((row, index) => ({
      ...row,
      score: Number(paged[index]?.hybrid_score.toFixed(4) ?? 0),
    })),
  };
}

export async function semanticSearch(params: SearchParams) {
  const searchQuery = params.query.trim();
  if (!searchQuery) {
    // Keep default semantic view behavior aligned with keyword mode.
    return keywordSearch(params);
  }

  const queryVectorLiteral = await getOrCreateQueryEmbedding(searchQuery);
  if (!(await isPgVectorReady())) {
    return semanticSearchLegacy(params, queryVectorLiteral);
  }

  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);
  queryParams.query_vector = queryVectorLiteral;
  queryParams.limit = params.pageSize;
  queryParams.offset = (params.page - 1) * params.pageSize;

  const countRow = await queryOne<{ total: string | number }>(
    `
      SELECT COUNT(*) AS total
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereClauses.join(" AND ")}
    `,
    queryParams,
  );

  const rows = await query<SearchResultRow & { score: number }>(`
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
        ${COMBINED_SNAPSHOT_SELECT_SQL},
        1 - (e.vector <=> @query_vector::vector(1536)) AS score
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereClauses.join(" AND ")}
      ${buildSemanticSortClause(params.sort)}
      LIMIT @limit OFFSET @offset
    `, queryParams);

  return {
    total: Number(countRow?.total ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(rows).map((row, index) => ({
      ...row,
      score: Number(rows[index]?.score.toFixed(4) ?? 0),
    })),
  };
}

export async function hybridSearch(params: SearchParams) {
  const searchQuery = params.query.trim();
  if (!searchQuery) {
    return keywordSearch(params);
  }

  const queryVectorLiteral = await getOrCreateQueryEmbedding(searchQuery);
  if (!(await isPgVectorReady())) {
    return hybridSearchLegacy(params, queryVectorLiteral);
  }

  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);
  applyKeywordLikeParams(searchQuery, queryParams);
  queryParams.query_vector = queryVectorLiteral;
  queryParams.limit = params.pageSize;
  queryParams.offset = (params.page - 1) * params.pageSize;

  const keywordScoreSql = buildKeywordScoreSql();
  const semanticScoreSql = "COALESCE(1 - (e.vector <=> @query_vector::vector(1536)), 0)";
  const hybridScoreSql = `(${semanticScoreSql} * 0.72 + LEAST(${keywordScoreSql}, 1.4) * 0.45)`;
  const rankableWhereSql = [...whereClauses, `(e.vector IS NOT NULL OR ${keywordScoreSql} > 0)`].join(" AND ");

  const countRow = await queryOne<{ total: string | number }>(
    `
      SELECT COUNT(*) AS total
      FROM companies c
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${rankableWhereSql}
    `,
    queryParams,
  );

  const rows = await query<SearchResultRow & { hybrid_score: number }>(`
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
        ${COMBINED_SNAPSHOT_SELECT_SQL},
        ${hybridScoreSql} AS hybrid_score
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${rankableWhereSql}
      ${buildHybridSortClause(params.sort)}
      LIMIT @limit OFFSET @offset
    `, queryParams);

  return {
    total: Number(countRow?.total ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    results: hydrateResultRows(rows).map((row, index) => ({
      ...row,
      score: Number(rows[index]?.hybrid_score.toFixed(4) ?? 0),
    })),
  };
}

export async function getHybridTopCompanyIds(params: SearchParams, limit = 100) {
  const searchQuery = params.query.trim();
  if (!searchQuery) {
    return [];
  }

  const queryVectorLiteral = await getOrCreateQueryEmbedding(searchQuery);
  if (!(await isPgVectorReady())) {
    const legacy = await hybridSearchLegacy(
      {
        ...params,
        page: 1,
        pageSize: Math.max(limit, params.pageSize),
      },
      queryVectorLiteral,
    );
    return legacy.results.slice(0, limit).map((row) => row.id);
  }

  const whereClauses = ["1=1"];
  const queryParams: Record<string, string | number> = {};
  buildFilterWhereClause(params.filters, queryParams, whereClauses);
  applyKeywordLikeParams(searchQuery, queryParams);
  queryParams.query_vector = queryVectorLiteral;
  queryParams.limit = limit;

  const keywordScoreSql = buildKeywordScoreSql();
  const semanticScoreSql = "COALESCE(1 - (e.vector <=> @query_vector::vector(1536)), 0)";
  const hybridScoreSql = `(${semanticScoreSql} * 0.72 + LEAST(${keywordScoreSql}, 1.4) * 0.45)`;
  const rankableWhereSql = [...whereClauses, `(e.vector IS NOT NULL OR ${keywordScoreSql} > 0)`].join(" AND ");

  const rows = await query<{ id: number }>(`
      SELECT c.id
      FROM companies c
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${rankableWhereSql}
      ${buildHybridSortClause("relevance").replace("hybrid_score", hybridScoreSql)}
      LIMIT @limit
    `, queryParams);

  return rows.map((row) => row.id);
}

export async function getSemanticTopCompanyIds(params: SearchParams, limit = 100) {
  const searchQuery = params.query.trim();
  if (!searchQuery) {
    return [];
  }

  const queryVectorLiteral = await getOrCreateQueryEmbedding(searchQuery);
  const { whereSql, queryParams } = buildFilterOnlySql(params.filters);

  if (!(await isPgVectorReady())) {
    const rows = await query<{ id: number; vector: string }>(`
        SELECT c.id, e.vector
        FROM companies c
        INNER JOIN company_embeddings e ON e.company_id = c.id
        WHERE ${whereSql}
      `, queryParams);

    const queryVector = parseVectorString(queryVectorLiteral);
    return rows
      .map((row) => {
        const vector = parseVectorString(row.vector);
        if (vector.length !== queryVector.length || vector.length === 0) {
          return { id: row.id, score: 0 };
        }

        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vector.length; i += 1) {
          dot += queryVector[i] * vector[i];
          normA += queryVector[i] * queryVector[i];
          normB += vector[i] * vector[i];
        }

        const score = !normA || !normB ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
        return { id: row.id, score };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((row) => row.id);
  }

  queryParams.query_vector = queryVectorLiteral;
  queryParams.limit = limit;

  const rows = await query<{ id: number }>(`
      SELECT c.id
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereSql}
      ORDER BY e.vector <=> @query_vector::vector(1536), c.top_company DESC, c.name ASC
      LIMIT @limit
    `, queryParams);

  return rows.map((row) => row.id);
}

type ChatContextRow = {
  id: number;
  name: string;
  website: string | null;
  url: string | null;
  one_liner: string | null;
  long_description: string | null;
  website_url: string | null;
  content_markdown: string | null;
};

export type CompanyChatCitation = {
  id: number;
  name: string;
  companyPage: string;
  whyRelevant: string;
  urls: string[];
};

export type CompanyChatAnswer = {
  answer: string;
  citations: CompanyChatCitation[];
};

function buildSocialAndRelevantUrls(row: ChatContextRow) {
  return buildCompanyLinks({
    website: row.website,
    ycUrl: row.url,
    snapshotWebsiteUrl: row.website_url,
    contentMarkdown: row.content_markdown,
  }).map((link) => link.url);
}

function stripFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function answerCompanyQuestion(
  question: string,
  filters: SearchFilters,
  topK = 8,
): Promise<CompanyChatAnswer> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return { answer: "", citations: [] };
  }

  const semantic = await semanticSearch({
    query: cleanQuestion,
    page: 1,
    pageSize: Math.min(20, Math.max(1, topK)),
    sort: "relevance",
    filters,
  });

  if (semantic.results.length === 0) {
    return {
      answer: "No matching companies were found for that question with the current filters.",
      citations: [],
    };
  }

  const ids = semantic.results.map((item) => item.id);
  const placeholders = ids.map((_, index) => `@id_${index}`);
  const idParams: Record<string, number> = {};
  ids.forEach((id, index) => {
    idParams[`id_${index}`] = id;
  });

  const rows = await query<ChatContextRow>(`
      SELECT
        c.id,
        c.name,
        c.website,
        c.url,
        c.one_liner,
        c.long_description,
        ${COMBINED_SNAPSHOT_SELECT_SQL}
      FROM companies c
      ${COMBINED_SNAPSHOT_JOIN_SQL}
      WHERE c.id IN (${placeholders.join(", ")})
    `, idParams);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = ids.map((id) => byId.get(id)).filter((row): row is ChatContextRow => Boolean(row));

  const context = orderedRows.map((row) => {
    const descriptionFromSnapshot = row.content_markdown
      ? extractDescriptionFromMarkdown(row.content_markdown)
      : "";
    const mergedDescription = [row.one_liner, row.long_description, descriptionFromSnapshot]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1800);
    const urls = buildSocialAndRelevantUrls(row);

    return {
      id: row.id,
      name: row.name,
      companyPage: `/companies/${row.id}`,
      description: mergedDescription,
      urls,
    };
  });

  const openai = getOpenAiClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You answer questions about YC companies using provided context only.",
          "Be concise and concrete.",
          "Return strict JSON with shape:",
          `{"answer":"...","citations":[{"id":123,"name":"...","companyPage":"/companies/123","whyRelevant":"...","urls":["..."]}]}`,
          "Each citation must reference a company from the context.",
          "Prefer URLs that are social profiles or primary product/company links.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            question: cleanQuestion,
            companies: context,
          },
          null,
          2,
        ),
      },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(stripFence(raw)) as Partial<CompanyChatAnswer>;
  const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
  const contextById = new Map(context.map((item) => [item.id, item]));

  const normalizedCitations = citations
    .filter((item): item is CompanyChatCitation => {
      if (!item || typeof item !== "object") {
        return false;
      }
      return (
        typeof item.id === "number" &&
        typeof item.name === "string" &&
        typeof item.companyPage === "string" &&
        typeof item.whyRelevant === "string" &&
        Array.isArray(item.urls)
      );
    })
    .filter((item) => contextById.has(item.id))
    .map((item) => ({
      ...item,
      urls: item.urls.filter((value): value is string => typeof value === "string").slice(0, 8),
    }));

  const fallbackCitations: CompanyChatCitation[] = context.slice(0, 3).map((item) => ({
    id: item.id,
    name: item.name,
    companyPage: item.companyPage,
    whyRelevant: "Semantically relevant to your question and backed by Crawl4AI snapshot content.",
    urls: item.urls.slice(0, 8),
  }));

  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    citations: normalizedCitations.length > 0 ? normalizedCitations : fallbackCitations,
  };
}

export async function getFacets() {
  const companies = await query<{
    batch: string | null;
    tags: string;
    industries: string;
    regions: string;
    stage: string | null;
    launched_at: number | null;
  }>(`
      SELECT batch, tags, industries, regions, stage, launched_at
      FROM companies
    `);

  const batchCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const stageCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  for (const company of companies) {
    if (company.batch) {
      batchCounts.set(company.batch, (batchCounts.get(company.batch) ?? 0) + 1);
    }
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
    batches: formatFacet(batchCounts).sort((left, right) => {
      const leftSort = batchSortKey(left.value);
      const rightSort = batchSortKey(right.value);
      const leftYear = leftSort.year ?? Number.NEGATIVE_INFINITY;
      const rightYear = rightSort.year ?? Number.NEGATIVE_INFINITY;

      if (leftYear !== rightYear) {
        return rightYear - leftYear;
      }
      if (leftSort.seasonOrder !== rightSort.seasonOrder) {
        return leftSort.seasonOrder - rightSort.seasonOrder;
      }
      return left.value.localeCompare(right.value);
    }),
    tags: formatFacet(tagCounts),
    industries: formatFacet(industryCounts),
    regions: formatFacet(regionCounts),
    stages: formatFacet(stageCounts),
    years: formatFacet(yearCounts).sort((left, right) => Number(right.value) - Number(left.value)),
  };
}

type AnalyticsColorBy = "none" | "tags" | "industries";

type BatchAggregate = {
  batch: string;
  year: number | null;
  seasonOrder: number;
  total: number;
  categoryCounts: Map<string, number>;
};

function batchSortKey(batch: string): { year: number | null; seasonOrder: number } {
  const compactBatchMatch = batch.match(/^([WSF])(\d{2})$/i);
  if (compactBatchMatch) {
    const season = compactBatchMatch[1].toUpperCase();
    const year = 2000 + Number(compactBatchMatch[2]);
    const seasonOrder = season === "W" ? 1 : season === "S" ? 2 : 3;
    return { year, seasonOrder };
  }

  const namedBatchMatch = batch.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (namedBatchMatch) {
    const season = namedBatchMatch[1].toLowerCase();
    const year = Number(namedBatchMatch[2]);
    const seasonOrder =
      season === "winter" ? 1 : season === "spring" ? 2 : season === "summer" ? 3 : 4;
    return { year, seasonOrder };
  }

  return { year: null, seasonOrder: 99 };
}

function firstCategory(row: AnalyticsCompanyRow, colorBy: Exclude<AnalyticsColorBy, "none">) {
  if (colorBy === "tags") {
    const tags = parseJsonArray(row.tags);
    return tags[0] ?? "Unspecified";
  }

  const industries = parseJsonArray(row.industries);
  return industries[0] ?? "Unspecified";
}

export async function getBatchAnalytics(
  params: SearchParams,
  colorBy: AnalyticsColorBy,
  topN = 8,
  companyIdSubset?: number[],
) {
  let rows: AnalyticsCompanyRow[] = [];

  if (companyIdSubset && companyIdSubset.length > 0) {
    const ids = [...new Set(companyIdSubset)];
    const placeholders = ids.map((_, index) => `@id_${index}`);
    const idParams: Record<string, number> = {};
    ids.forEach((id, index) => {
      idParams[`id_${index}`] = id;
    });
    rows = await query<AnalyticsCompanyRow>(`
        SELECT c.id, c.batch, c.launched_at, c.tags, c.industries
        FROM companies c
        WHERE c.id IN (${placeholders.join(", ")})
      `, idParams);
  } else if (companyIdSubset && companyIdSubset.length === 0) {
    rows = [];
  } else {
    const { whereSql, queryParams } = buildKeywordAndFilterSql(params);
    rows = await query<AnalyticsCompanyRow>(`
        SELECT c.id, c.batch, c.launched_at, c.tags, c.industries
        FROM companies c
        WHERE ${whereSql}
      `, queryParams);
  }

  const aggregateByBatch = new Map<string, BatchAggregate>();
  const globalCategoryCounts = new Map<string, number>();

  for (const row of rows) {
    const batch = row.batch ?? "Unspecified";
    const sort = batchSortKey(batch);
    const existing = aggregateByBatch.get(batch) ?? {
      batch,
      year: sort.year,
      seasonOrder: sort.seasonOrder,
      total: 0,
      categoryCounts: new Map<string, number>(),
    };
    existing.total += 1;

    if (colorBy !== "none") {
      const category = firstCategory(row, colorBy);
      existing.categoryCounts.set(category, (existing.categoryCounts.get(category) ?? 0) + 1);
      globalCategoryCounts.set(category, (globalCategoryCounts.get(category) ?? 0) + 1);
    }

    aggregateByBatch.set(batch, existing);
  }

  const sortedBatches = [...aggregateByBatch.values()].sort((left, right) => {
    const yearLeft = left.year ?? Number.MAX_SAFE_INTEGER;
    const yearRight = right.year ?? Number.MAX_SAFE_INTEGER;
    if (yearLeft !== yearRight) {
      return yearLeft - yearRight;
    }
    if (left.seasonOrder !== right.seasonOrder) {
      return left.seasonOrder - right.seasonOrder;
    }
    return left.batch.localeCompare(right.batch);
  });

  const topCategories =
    colorBy === "none"
      ? []
      : [...globalCategoryCounts.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, topN)
          .map(([category]) => category);

  const chartRows = sortedBatches.map((batchAggregate) => {
    const row: Record<string, number | string | null> = {
      batch: batchAggregate.batch,
      year: batchAggregate.year,
      total: batchAggregate.total,
    };

    if (colorBy === "none") {
      return row;
    }

    let assigned = 0;
    for (const category of topCategories) {
      const value = batchAggregate.categoryCounts.get(category) ?? 0;
      row[category] = value;
      assigned += value;
    }
    row.Other = Math.max(0, batchAggregate.total - assigned);

    return row;
  });

  return {
    colorBy,
    totalCompanies: rows.length,
    series: colorBy === "none" ? ["total"] : [...topCategories, "Other"],
    rows: chartRows,
  };
}
