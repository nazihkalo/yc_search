import { hasDatabaseUrl, initializeDatabase, query, queryOne } from "./db";
import { batchSortKey } from "./search";

export type BatchCount = { batch: string; count: number; year: number | null };
export type YearCount = { year: number; count: number };
export type NamedCount = { name: string; count: number };
export type TrendingTag = { name: string; recent: number; growth: number };

export type Overview = {
  companies: number;
  founders: number;
  hiring: number;
  batchCount: number;
  /** Newest first. */
  batches: BatchCount[];
  /** Oldest first, for charting. */
  years: YearCount[];
  industries: NamedCount[];
  tags: NamedCount[];
  /** Tags over-represented in the most recent batches. */
  trendingTags: TrendingTag[];
  recentBatchNames: string[];
};

const EMPTY: Overview = {
  companies: 0,
  founders: 0,
  hiring: 0,
  batchCount: 0,
  batches: [],
  years: [],
  industries: [],
  tags: [],
  trendingTags: [],
  recentBatchNames: [],
};

const TTL_MS = 10 * 60 * 1000;
const RECENT_BATCHES = 4;
let cache: { at: number; value: Overview } | null = null;

function compareBatchesNewestFirst(a: string, b: string) {
  const left = batchSortKey(a);
  const right = batchSortKey(b);
  const leftYear = left.year ?? Number.NEGATIVE_INFINITY;
  const rightYear = right.year ?? Number.NEGATIVE_INFINITY;
  if (leftYear !== rightYear) return rightYear - leftYear;
  if (left.seasonOrder !== right.seasonOrder) return right.seasonOrder - left.seasonOrder;
  return a.localeCompare(b);
}

async function loadOverview(): Promise<Overview> {
  await initializeDatabase();

  const [totals, batchRows, industryRows, tagRows] = await Promise.all([
    queryOne<{ companies: string; founders: string; hiring: string }>(`
      SELECT
        (SELECT COUNT(*) FROM companies)::text AS companies,
        (SELECT COUNT(*) FROM founders)::text AS founders,
        (SELECT COUNT(*) FROM companies WHERE is_hiring = 1)::text AS hiring
    `),
    query<{ batch: string; n: string }>(`
      SELECT batch, COUNT(*)::text AS n
      FROM companies
      WHERE batch IS NOT NULL AND batch <> '' AND batch <> 'Unspecified'
      GROUP BY batch
    `),
    query<{ name: string; n: string }>(`
      SELECT value AS name, COUNT(*)::text AS n
      FROM companies, jsonb_array_elements_text(
        CASE WHEN industries ~ '^\\s*\\[' THEN industries::jsonb ELSE '[]'::jsonb END
      ) AS value
      GROUP BY value
      ORDER BY COUNT(*) DESC
      LIMIT 40
    `),
    query<{ name: string; batch: string | null; n: string }>(`
      SELECT value AS name, batch, COUNT(*)::text AS n
      FROM companies, jsonb_array_elements_text(
        CASE WHEN tags ~ '^\\s*\\[' THEN tags::jsonb ELSE '[]'::jsonb END
      ) AS value
      GROUP BY value, batch
    `),
  ]);

  const batches: BatchCount[] = batchRows
    .map((row) => ({ batch: row.batch, count: Number(row.n), year: batchSortKey(row.batch).year }))
    .sort((a, b) => compareBatchesNewestFirst(a.batch, b.batch));

  const yearMap = new Map<number, number>();
  for (const row of batches) {
    if (row.year === null) continue;
    yearMap.set(row.year, (yearMap.get(row.year) ?? 0) + row.count);
  }
  const years = [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // Skip partial/upcoming batches (a handful of early announcements) so they
  // don't distort the "trending" math.
  const recentBatchNames = batches
    .filter((b) => b.year !== null && b.count >= 50)
    .slice(0, RECENT_BATCHES)
    .map((b) => b.batch);
  const recentSet = new Set(recentBatchNames);
  const recentTotal = batches.filter((b) => recentSet.has(b.batch)).reduce((acc, b) => acc + b.count, 0);
  const companies = Number(totals?.companies ?? 0);

  const tagTotals = new Map<string, { all: number; recent: number }>();
  for (const row of tagRows) {
    const entry = tagTotals.get(row.name) ?? { all: 0, recent: 0 };
    const n = Number(row.n);
    entry.all += n;
    if (row.batch && recentSet.has(row.batch)) entry.recent += n;
    tagTotals.set(row.name, entry);
  }

  const tags = [...tagTotals.entries()]
    .map(([name, v]) => ({ name, count: v.all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  const trendingTags = [...tagTotals.entries()]
    .filter(([, v]) => v.recent >= 8 && recentTotal > 0 && companies > 0)
    .map(([name, v]) => ({
      name,
      recent: v.recent,
      growth: v.recent / recentTotal / (v.all / companies),
    }))
    .filter((t) => t.growth > 1)
    .sort((a, b) => b.recent * Math.log(b.growth + 1) - a.recent * Math.log(a.growth + 1))
    .slice(0, 12);

  return {
    companies,
    founders: Number(totals?.founders ?? 0),
    hiring: Number(totals?.hiring ?? 0),
    batchCount: batches.length,
    batches,
    years,
    industries: industryRows.map((row) => ({ name: row.name, count: Number(row.n) })),
    tags,
    trendingTags,
    recentBatchNames,
  };
}

export async function getOverview(): Promise<Overview> {
  if (!hasDatabaseUrl()) return EMPTY;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const value = await loadOverview();
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("[overview] failed to load", error);
    return cache?.value ?? EMPTY;
  }
}
