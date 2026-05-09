import { query } from "./db";
import type { SearchFilters, SearchParams } from "./search";

type VendorAnalyticsRow = {
  vendor_id: string | number;
  canonical_name: string;
  domain: string | null;
  vendor_category: string;
  company_id: number;
  relationship_type: string;
  relationship_category: string;
  source_kind: string;
};

export type VendorAnalyticsOptions = {
  topN?: number;
  category?: string | null;
  relationshipTypes?: string[];
  sourceListName?: string | null;
};

export type VendorAnalyticsPayload = {
  totalCompanies: number;
  totalRelationships: number;
  topVendors: Array<{
    id: number;
    name: string;
    category: string;
    domain: string | null;
    companyCount: number;
    relationshipCount: number;
    sourceCounts: Record<string, number>;
  }>;
  categories: Array<{ category: string; companyCount: number; relationshipCount: number }>;
  sourceKinds: Array<{ sourceKind: string; companyCount: number; relationshipCount: number }>;
  relationshipTypes: Array<{ relationshipType: string; companyCount: number; relationshipCount: number }>;
};

type VendorDetailRow = {
  vendor_id: string | number;
  canonical_name: string;
  domain: string | null;
  vendor_category: string;
  company_id: number;
  company_name: string;
  website: string | null;
  small_logo_thumb_url: string | null;
  one_liner: string | null;
  industry: string | null;
  batch: string | null;
  source_kind: string;
  source_rank: string | number | null;
  source_list_name: string | null;
  relationship_type: string;
  relationship_category: string;
  confidence: string | number;
  evidence_url: string | null;
  evidence_snippet: string | null;
  source_type: string;
  last_checked_at: string | Date;
};

export type VendorDetailPayload = {
  vendor: {
    id: number;
    name: string;
    domain: string | null;
    category: string;
    companyCount: number;
    relationshipCount: number;
    sourceCounts: Record<string, number>;
    relationshipTypeCounts: Record<string, number>;
  };
  companies: Array<{
    id: number;
    name: string;
    website: string | null;
    logoUrl: string | null;
    oneLiner: string | null;
    industry: string | null;
    batch: string | null;
    sourceKind: string;
    sourceRank: number | null;
    sourceListName: string | null;
    relationships: Array<{
      relationshipType: string;
      category: string;
      confidence: number;
      evidenceUrl: string | null;
      evidenceSnippet: string | null;
      sourceType: string;
      lastCheckedAt: string;
    }>;
  }>;
};

function buildCompanyFilterWhereClause(
  searchQuery: string,
  filters: SearchFilters,
  params: Record<string, string | number>,
  fragments: string[],
) {
  if (searchQuery.length > 0) {
    params.query = `%${searchQuery.toLowerCase()}%`;
    fragments.push(`
      (
        LOWER(c.name) LIKE @query
        OR LOWER(c.one_liner) LIKE @query
        OR LOWER(c.long_description) LIKE @query
        OR LOWER(c.search_text) LIKE @query
      )
    `);
  }

  if (filters.sources.length > 0) {
    const placeholders = filters.sources.map((_, index) => `@source_${index}`);
    filters.sources.forEach((source, index) => {
      params[`source_${index}`] = source;
    });
    fragments.push(`c.source_kind IN (${placeholders.join(", ")})`);
  }

  if (filters.isHiring) fragments.push("c.is_hiring = 1");
  if (filters.nonprofit) fragments.push("c.nonprofit = 1");
  if (filters.topCompany) fragments.push("c.top_company = 1");

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

function setToCountRecord(map: Map<string, Set<number>>) {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, value.size]));
}

export async function getVendorAnalytics(
  params: SearchParams,
  options: VendorAnalyticsOptions = {},
): Promise<VendorAnalyticsPayload> {
  const queryParams: Record<string, string | number> = {};
  const whereClauses = ["1=1"];
  buildCompanyFilterWhereClause(params.query.trim(), params.filters, queryParams, whereClauses);

  if (options.category) {
    queryParams.vendor_category = options.category;
    whereClauses.push("cv.category = @vendor_category");
  }

  if (options.sourceListName) {
    queryParams.source_list_name = options.sourceListName;
    whereClauses.push("c.source_list_name = @source_list_name");
  }

  if (options.relationshipTypes?.length) {
    const placeholders = options.relationshipTypes.map((_, index) => `@relationship_type_${index}`);
    options.relationshipTypes.forEach((type, index) => {
      queryParams[`relationship_type_${index}`] = type;
    });
    whereClauses.push(`cv.relationship_type IN (${placeholders.join(", ")})`);
  }

  const rows = await query<VendorAnalyticsRow>(`
    SELECT
      v.id AS vendor_id,
      v.canonical_name,
      v.domain,
      v.category AS vendor_category,
      cv.company_id,
      cv.relationship_type,
      cv.category AS relationship_category,
      c.source_kind
    FROM company_vendors cv
    INNER JOIN vendors v ON v.id = cv.vendor_id
    INNER JOIN companies c ON c.id = cv.company_id
    WHERE ${whereClauses.join(" AND ")}
  `, queryParams);

  const topN = Math.max(1, Math.min(200, options.topN ?? 12));
  const totalCompanyIds = new Set<number>();
  const vendors = new Map<number, {
    id: number;
    name: string;
    category: string;
    domain: string | null;
    companyIds: Set<number>;
    relationshipCount: number;
    sourceCompanyIds: Map<string, Set<number>>;
  }>();
  const categories = new Map<string, { companyIds: Set<number>; relationshipCount: number }>();
  const sources = new Map<string, { companyIds: Set<number>; relationshipCount: number }>();
  const relationshipTypes = new Map<string, { companyIds: Set<number>; relationshipCount: number }>();

  for (const row of rows) {
    const vendorId = Number(row.vendor_id);
    totalCompanyIds.add(row.company_id);

    const vendor = vendors.get(vendorId) ?? {
      id: vendorId,
      name: row.canonical_name,
      category: row.vendor_category,
      domain: row.domain,
      companyIds: new Set<number>(),
      relationshipCount: 0,
      sourceCompanyIds: new Map<string, Set<number>>(),
    };
    vendor.companyIds.add(row.company_id);
    vendor.relationshipCount += 1;
    const sourceSet = vendor.sourceCompanyIds.get(row.source_kind) ?? new Set<number>();
    sourceSet.add(row.company_id);
    vendor.sourceCompanyIds.set(row.source_kind, sourceSet);
    vendors.set(vendorId, vendor);

    const category = categories.get(row.relationship_category) ?? { companyIds: new Set<number>(), relationshipCount: 0 };
    category.companyIds.add(row.company_id);
    category.relationshipCount += 1;
    categories.set(row.relationship_category, category);

    const source = sources.get(row.source_kind) ?? { companyIds: new Set<number>(), relationshipCount: 0 };
    source.companyIds.add(row.company_id);
    source.relationshipCount += 1;
    sources.set(row.source_kind, source);

    const relationship = relationshipTypes.get(row.relationship_type) ?? { companyIds: new Set<number>(), relationshipCount: 0 };
    relationship.companyIds.add(row.company_id);
    relationship.relationshipCount += 1;
    relationshipTypes.set(row.relationship_type, relationship);
  }

  return {
    totalCompanies: totalCompanyIds.size,
    totalRelationships: rows.length,
    topVendors: [...vendors.values()]
      .sort((left, right) => {
        if (left.companyIds.size !== right.companyIds.size) return right.companyIds.size - left.companyIds.size;
        if (left.relationshipCount !== right.relationshipCount) return right.relationshipCount - left.relationshipCount;
        return left.name.localeCompare(right.name);
      })
      .slice(0, topN)
      .map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        domain: vendor.domain,
        companyCount: vendor.companyIds.size,
        relationshipCount: vendor.relationshipCount,
        sourceCounts: setToCountRecord(vendor.sourceCompanyIds),
      })),
    categories: [...categories.entries()]
      .map(([category, value]) => ({
        category,
        companyCount: value.companyIds.size,
        relationshipCount: value.relationshipCount,
      }))
      .sort((left, right) => right.companyCount - left.companyCount || right.relationshipCount - left.relationshipCount),
    sourceKinds: [...sources.entries()]
      .map(([sourceKind, value]) => ({
        sourceKind,
        companyCount: value.companyIds.size,
        relationshipCount: value.relationshipCount,
      }))
      .sort((left, right) => right.companyCount - left.companyCount || left.sourceKind.localeCompare(right.sourceKind)),
    relationshipTypes: [...relationshipTypes.entries()]
      .map(([relationshipType, value]) => ({
        relationshipType,
        companyCount: value.companyIds.size,
        relationshipCount: value.relationshipCount,
      }))
      .sort((left, right) => right.companyCount - left.companyCount || left.relationshipType.localeCompare(right.relationshipType)),
  };
}

function incrementRecord(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

export async function getVendorDetail(vendorId: number): Promise<VendorDetailPayload | null> {
  const rows = await query<VendorDetailRow>(`
    SELECT
      v.id AS vendor_id,
      v.canonical_name,
      v.domain,
      v.category AS vendor_category,
      c.id AS company_id,
      c.name AS company_name,
      c.website,
      c.small_logo_thumb_url,
      c.one_liner,
      c.industry,
      c.batch,
      c.source_kind,
      c.source_rank,
      c.source_list_name,
      cv.relationship_type,
      cv.category AS relationship_category,
      cv.confidence,
      cv.evidence_url,
      cv.evidence_snippet,
      cv.source_type,
      cv.last_checked_at
    FROM vendors v
    INNER JOIN company_vendors cv ON cv.vendor_id = v.id
    INNER JOIN companies c ON c.id = cv.company_id
    WHERE v.id = @vendor_id
    ORDER BY
      c.source_kind ASC,
      c.source_rank ASC NULLS LAST,
      c.name ASC,
      cv.confidence DESC,
      cv.relationship_type ASC
  `, { vendor_id: vendorId });

  const first = rows[0];
  if (!first) {
    return null;
  }

  const sourceCompanyIds = new Map<string, Set<number>>();
  const relationshipTypeCounts: Record<string, number> = {};
  const companies = new Map<number, VendorDetailPayload["companies"][number]>();

  for (const row of rows) {
    const sourceSet = sourceCompanyIds.get(row.source_kind) ?? new Set<number>();
    sourceSet.add(row.company_id);
    sourceCompanyIds.set(row.source_kind, sourceSet);
    incrementRecord(relationshipTypeCounts, row.relationship_type);

    const company = companies.get(row.company_id) ?? {
      id: row.company_id,
      name: row.company_name,
      website: row.website,
      logoUrl: row.small_logo_thumb_url,
      oneLiner: row.one_liner,
      industry: row.industry,
      batch: row.batch,
      sourceKind: row.source_kind,
      sourceRank: row.source_rank === null ? null : Number(row.source_rank),
      sourceListName: row.source_list_name,
      relationships: [],
    };
    company.relationships.push({
      relationshipType: row.relationship_type,
      category: row.relationship_category,
      confidence: Number(row.confidence),
      evidenceUrl: row.evidence_url,
      evidenceSnippet: row.evidence_snippet,
      sourceType: row.source_type,
      lastCheckedAt: row.last_checked_at instanceof Date
        ? row.last_checked_at.toISOString()
        : new Date(row.last_checked_at).toISOString(),
    });
    companies.set(row.company_id, company);
  }

  return {
    vendor: {
      id: Number(first.vendor_id),
      name: first.canonical_name,
      domain: first.domain,
      category: first.vendor_category,
      companyCount: companies.size,
      relationshipCount: rows.length,
      sourceCounts: Object.fromEntries([...sourceCompanyIds.entries()].map(([key, value]) => [key, value.size])),
      relationshipTypeCounts,
    },
    companies: [...companies.values()],
  };
}
