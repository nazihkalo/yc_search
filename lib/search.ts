import { getDb, parseJsonArray } from "./db";
import { EMBEDDING_MODEL, getOpenAiClient } from "./openai";
import { extractDescriptionFromMarkdown, extractUrlsFromMarkdown } from "./snapshot-utils";
import type { CompanyRecord } from "./types";

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

type SearchResultRow = CompanyRecord;
type AnalyticsCompanyRow = {
  id: number;
  batch: string | null;
  launched_at: number | null;
  tags: string;
  industries: string;
};

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

function buildKeywordAndFilterSql(params: SearchParams) {
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
    // Keep default semantic view behavior aligned with keyword mode.
    return keywordSearch(params);
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

export async function getSemanticTopCompanyIds(params: SearchParams, limit = 100) {
  const db = getDb();
  const query = params.query.trim();
  if (!query) {
    return [];
  }

  const { whereSql, queryParams } = buildFilterOnlySql(params.filters);
  const openai = getOpenAiClient();
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });
  const queryVector = embeddingResponse.data[0]?.embedding ?? [];

  const rows = db
    .prepare<[{ [key: string]: string | number }], { id: number; vector: string }>(`
      SELECT c.id, e.vector
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE ${whereSql}
    `)
    .all(queryParams);

  return rows
    .map((row) => ({
      id: row.id,
      score: cosineSimilarity(queryVector, JSON.parse(row.vector) as number[]),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((row) => row.id);
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
  const baseUrls = [row.website, row.url, row.website_url].filter((value): value is string => Boolean(value));
  const snapshotUrls = row.content_markdown ? extractUrlsFromMarkdown(row.content_markdown) : [];
  const all = new Set<string>([...baseUrls, ...snapshotUrls]);
  const ordered = [...all];

  const socialDomains = [
    "linkedin.com",
    "x.com",
    "twitter.com",
    "github.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "discord.com",
    "t.me",
    "medium.com",
  ];

  const socials = ordered.filter((candidate) => socialDomains.some((domain) => candidate.includes(domain)));
  const nonSocial = ordered.filter((candidate) => !socials.includes(candidate));
  return [...socials, ...nonSocial].slice(0, 12);
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

  const db = getDb();
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

  const rows = db
    .prepare<[{ [key: string]: number }], ChatContextRow>(`
      SELECT
        c.id,
        c.name,
        c.website,
        c.url,
        c.one_liner,
        c.long_description,
        s.website_url,
        s.content_markdown
      FROM companies c
      LEFT JOIN website_snapshots s
        ON s.company_id = c.id AND s.source = 'crawl4ai'
      WHERE c.id IN (${placeholders.join(", ")})
    `)
    .all(idParams);

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

export function getBatchAnalytics(
  params: SearchParams,
  colorBy: AnalyticsColorBy,
  topN = 8,
  companyIdSubset?: number[],
) {
  const db = getDb();
  let rows: AnalyticsCompanyRow[] = [];

  if (companyIdSubset && companyIdSubset.length > 0) {
    const ids = [...new Set(companyIdSubset)];
    const placeholders = ids.map((_, index) => `@id_${index}`);
    const idParams: Record<string, number> = {};
    ids.forEach((id, index) => {
      idParams[`id_${index}`] = id;
    });
    rows = db
      .prepare<[{ [key: string]: number }], AnalyticsCompanyRow>(`
        SELECT c.id, c.batch, c.launched_at, c.tags, c.industries
        FROM companies c
        WHERE c.id IN (${placeholders.join(", ")})
      `)
      .all(idParams);
  } else if (companyIdSubset && companyIdSubset.length === 0) {
    rows = [];
  } else {
    const { whereSql, queryParams } = buildKeywordAndFilterSql(params);
    rows = db
      .prepare<[{ [key: string]: string | number }], AnalyticsCompanyRow>(`
        SELECT c.id, c.batch, c.launched_at, c.tags, c.industries
        FROM companies c
        WHERE ${whereSql}
      `)
      .all(queryParams);
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
