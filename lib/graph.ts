import { isPgVectorReady, parseJsonArray, query, queryOne } from "./db";
import { hybridSearch, type SearchParams } from "./search";

export type GraphNode = {
  id: number;
  name: string;
  slug: string | null;
  one_liner: string | null;
  batch: string | null;
  industry: string | null;
  stage: string | null;
  team_size: number | null;
  top_company: boolean;
  is_hiring: boolean;
  small_logo_thumb_url: string | null;
  website: string | null;
  url: string | null;
  industries: string[];
  isFocus?: boolean;
  similarity?: number;
};

export type GraphLink = {
  source: number;
  target: number;
  weight: number;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    nodeCount: number;
    linkCount: number;
    pgVector: boolean;
    truncated: boolean;
    focusId?: number;
  };
};

export type GraphOptions = {
  maxNodes?: number;
  kNearest?: number;
};

type EdgeRow = {
  source: number;
  target: number;
  weight: number;
};

type CompanyNodeRow = {
  id: number;
  name: string;
  slug: string | null;
  one_liner: string | null;
  batch: string | null;
  industry: string | null;
  stage: string | null;
  team_size: number | null;
  top_company: number | boolean;
  is_hiring: number | boolean;
  small_logo_thumb_url: string | null;
  website: string | null;
  url: string | null;
  industries: string | null;
};

function hydrateNode(row: CompanyNodeRow): GraphNode {
  const industries = typeof row.industries === "string" ? parseJsonArray(row.industries) : [];
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    one_liner: row.one_liner,
    batch: row.batch,
    industry: row.industry,
    stage: row.stage,
    team_size: row.team_size,
    top_company: Boolean(row.top_company),
    is_hiring: Boolean(row.is_hiring),
    small_logo_thumb_url: row.small_logo_thumb_url,
    website: row.website,
    url: row.url,
    industries,
  };
}

async function fetchEdgesAmongIds(ids: number[], kNearest: number) {
  if (ids.length < 2) return [] as EdgeRow[];
  if (!(await isPgVectorReady())) return [] as EdgeRow[];

  const idsLiteral = `{${ids.join(",")}}`;
  return await query<EdgeRow>(
    `
      WITH filtered AS (
        SELECT company_id, vector
        FROM company_embeddings
        WHERE company_id = ANY(@ids::int[])
      )
      SELECT
        LEAST(f.company_id, n.company_id) AS source,
        GREATEST(f.company_id, n.company_id) AS target,
        MAX(1 - (f.vector <=> n.vector)) AS weight
      FROM filtered f
      CROSS JOIN LATERAL (
        SELECT company_id, vector
        FROM filtered
        WHERE company_id <> f.company_id
        ORDER BY vector <=> f.vector
        LIMIT @k
      ) n
      GROUP BY LEAST(f.company_id, n.company_id), GREATEST(f.company_id, n.company_id)
    `,
    { ids: idsLiteral, k: kNearest },
  );
}

function normalizeLinks(edges: EdgeRow[]): GraphLink[] {
  return edges
    .map((row) => ({
      source: Number(row.source),
      target: Number(row.target),
      weight: Number(row.weight),
    }))
    .filter((edge) => Number.isFinite(edge.weight) && edge.source !== edge.target);
}

export async function getGraphData(
  params: SearchParams,
  options: GraphOptions = {},
): Promise<GraphData> {
  const maxNodes = Math.max(2, Math.min(options.maxNodes ?? 500, 1000));
  const kNearest = Math.max(2, Math.min(options.kNearest ?? 6, 24));

  const searchResult = await hybridSearch({
    ...params,
    page: 1,
    pageSize: maxNodes,
  });

  const truncated = searchResult.total > searchResult.results.length;

  const nodes: GraphNode[] = searchResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    one_liner: row.one_liner,
    batch: row.batch,
    industry: row.industry,
    stage: row.stage,
    team_size: row.team_size,
    top_company: Boolean(row.top_company),
    is_hiring: Boolean(row.is_hiring),
    small_logo_thumb_url: row.small_logo_thumb_url,
    website: row.website,
    url: row.url,
    industries: Array.isArray(row.industries)
      ? row.industries
      : typeof row.industries === "string"
        ? parseJsonArray(row.industries)
        : [],
  }));

  const pgVector = await isPgVectorReady();
  const ids = nodes.map((node) => node.id);
  const edgeRows = await fetchEdgesAmongIds(ids, kNearest);

  return {
    nodes,
    links: normalizeLinks(edgeRows),
    meta: {
      nodeCount: nodes.length,
      linkCount: edgeRows.length,
      pgVector,
      truncated,
    },
  };
}

export async function getFocusGraphData(
  focusId: number,
  options: GraphOptions = {},
): Promise<GraphData> {
  const maxNodes = Math.max(2, Math.min(options.maxNodes ?? 40, 200));
  const kNearest = Math.max(2, Math.min(options.kNearest ?? 5, 16));

  const pgVector = await isPgVectorReady();

  const focusCompany = await queryOne<CompanyNodeRow & { vector: string | null }>(
    `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.one_liner,
        c.batch,
        c.industry,
        c.stage,
        c.team_size,
        c.top_company,
        c.is_hiring,
        c.small_logo_thumb_url,
        c.website,
        c.url,
        c.industries,
        e.vector
      FROM companies c
      LEFT JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id = @id
      LIMIT 1
    `,
    { id: focusId },
  );

  if (!focusCompany) {
    return {
      nodes: [],
      links: [],
      meta: { nodeCount: 0, linkCount: 0, pgVector, truncated: false, focusId },
    };
  }

  const focusNode: GraphNode = {
    ...hydrateNode(focusCompany),
    isFocus: true,
    similarity: 1,
  };

  if (!focusCompany.vector || !pgVector) {
    return {
      nodes: [focusNode],
      links: [],
      meta: { nodeCount: 1, linkCount: 0, pgVector, truncated: false, focusId },
    };
  }

  const neighbors = await query<CompanyNodeRow & { similarity: number }>(
    `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.one_liner,
        c.batch,
        c.industry,
        c.stage,
        c.team_size,
        c.top_company,
        c.is_hiring,
        c.small_logo_thumb_url,
        c.website,
        c.url,
        c.industries,
        1 - (e.vector <=> @target_vector::vector(1536)) AS similarity
      FROM companies c
      INNER JOIN company_embeddings e ON e.company_id = c.id
      WHERE c.id <> @focus_id
      ORDER BY e.vector <=> @target_vector::vector(1536)
      LIMIT @limit
    `,
    {
      focus_id: focusId,
      target_vector: focusCompany.vector,
      limit: maxNodes - 1,
    },
  );

  const neighborNodes: GraphNode[] = neighbors.map((row) => ({
    ...hydrateNode(row),
    similarity: Number(row.similarity),
  }));

  const allNodes = [focusNode, ...neighborNodes];
  const ids = allNodes.map((node) => node.id);
  const edgeRows = await fetchEdgesAmongIds(ids, kNearest);

  return {
    nodes: allNodes,
    links: normalizeLinks(edgeRows),
    meta: {
      nodeCount: allNodes.length,
      linkCount: edgeRows.length,
      pgVector,
      truncated: false,
      focusId,
    },
  };
}
