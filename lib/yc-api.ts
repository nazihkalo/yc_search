import pLimit from "p-limit";
import { z } from "zod";

import type { YcCompany } from "./types";

const DEFAULT_ALGOLIA_APP_ID = "45BWZJ1SGC";
const ALGOLIA_INDEX = "YCCompany_By_Launch_Date_production";
const ALGOLIA_AGENT = "Algolia for JavaScript (3.35.1); Browser; JS Helper (3.16.1)";
const YC_DIRECTORY_URL = "https://www.ycombinator.com/companies";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FACETS_PARAM =
  "%5B%22app_answers%22%2C%22app_video_public%22%2C%22batch%22%2C%22demo_day_video_public%22%2C%22highlight_black%22%2C%22highlight_latinx%22%2C%22highlight_women%22%2C%22industries%22%2C%22isHiring%22%2C%22nonprofit%22%2C%22question_answers%22%2C%22regions%22%2C%22subindustry%22%2C%22tags%22%2C%22top_company%22%5D";

const HITS_PER_PAGE = 1000;
const BATCH_FETCH_CONCURRENCY = 3;

const nullableBoolean = z
  .boolean()
  .nullable()
  .optional()
  .transform((value) => Boolean(value));

const ycCompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  former_names: z.array(z.string()).default([]),
  small_logo_thumb_url: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  all_locations: z.string().nullable().optional(),
  long_description: z.string().nullable().optional(),
  one_liner: z.string().nullable().optional(),
  team_size: z.number().nullable().optional(),
  highlight_black: nullableBoolean,
  highlight_latinx: nullableBoolean,
  highlight_women: nullableBoolean,
  industry: z.string().nullable().optional(),
  subindustry: z.string().nullable().optional(),
  launched_at: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
  top_company: nullableBoolean,
  isHiring: nullableBoolean,
  nonprofit: nullableBoolean,
  batch: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  industries: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  stage: z.string().nullable().optional(),
  app_video_public: nullableBoolean,
  demo_day_video_public: nullableBoolean,
  question_answers: nullableBoolean,
});

type AlgoliaMultiResponse<T> = {
  results?: Array<{
    hits?: T[];
    facets?: Record<string, Record<string, number>>;
    nbHits?: number;
  }>;
};

type AlgoliaCredentials = { appId: string; apiKey: string };

let cachedCredentials: AlgoliaCredentials | null = null;

/**
 * YC's directory uses short-lived secured Algolia keys (they embed `validUntil`
 * and rotate roughly daily), so a hardcoded key stops working. Scrape the
 * current key from `window.AlgoliaOpts` on the public directory page instead.
 * `YC_ALGOLIA_API_KEY` still works as a manual override.
 */
async function fetchAlgoliaCredentials(): Promise<AlgoliaCredentials> {
  const response = await fetch(YC_DIRECTORY_URL, {
    headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load YC directory page (${response.status}).`);
  }
  const html = await response.text();
  const match = html.match(/window\.AlgoliaOpts\s*=\s*(\{[^;]*?\});/);
  if (!match) {
    throw new Error("Could not find window.AlgoliaOpts on the YC directory page.");
  }
  const opts = JSON.parse(match[1]) as { app?: string; key?: string };
  if (!opts.key) {
    throw new Error("window.AlgoliaOpts on the YC directory page has no key.");
  }
  return { appId: opts.app || DEFAULT_ALGOLIA_APP_ID, apiKey: opts.key };
}

async function getAlgoliaCredentials(forceRefresh = false): Promise<AlgoliaCredentials> {
  const override = process.env.YC_ALGOLIA_API_KEY?.trim();
  if (override) {
    return { appId: DEFAULT_ALGOLIA_APP_ID, apiKey: override };
  }
  if (!cachedCredentials || forceRefresh) {
    cachedCredentials = await fetchAlgoliaCredentials();
  }
  return cachedCredentials;
}

function slugifyBatch(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function algoliaQuery<T>(params: string, retried = false): Promise<AlgoliaMultiResponse<T>> {
  const { appId, apiKey } = await getAlgoliaCredentials();
  const url =
    `https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries` +
    `?x-algolia-agent=${encodeURIComponent(ALGOLIA_AGENT)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": appId,
      "X-Algolia-API-Key": apiKey,
    },
    body: JSON.stringify({
      requests: [{ indexName: ALGOLIA_INDEX, params }],
    }),
    cache: "no-store",
  });

  // Key may have expired mid-run; refresh once from the directory page.
  if ((response.status === 401 || response.status === 403) && !retried && !process.env.YC_ALGOLIA_API_KEY?.trim()) {
    await getAlgoliaCredentials(true);
    return algoliaQuery<T>(params, true);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Algolia request failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  return response.json() as Promise<AlgoliaMultiResponse<T>>;
}

async function fetchBatchFacets(): Promise<Record<string, number>> {
  const params = `facets=${FACETS_PARAM}&hitsPerPage=0&maxValuesPerFacet=1000&query=&tagFilters=`;
  const json = await algoliaQuery<never>(params);
  const batchFacets = json.results?.[0]?.facets?.batch;
  if (!batchFacets) {
    throw new Error("Algolia facets response did not include batch facets.");
  }
  return batchFacets;
}

async function fetchBatchCompanies(batch: string, expected: number): Promise<unknown[]> {
  const collected: unknown[] = [];
  let page = 0;
  const maxPages = Math.max(1, Math.ceil(expected / HITS_PER_PAGE) + 2);

  while (collected.length < expected && page < maxPages) {
    const params =
      `facets=${FACETS_PARAM}` +
      `&hitsPerPage=${HITS_PER_PAGE}` +
      `&maxValuesPerFacet=1000` +
      `&query=` +
      `&tagFilters=` +
      `&facetFilters=batch:${encodeURIComponent(batch)}` +
      `&page=${page}`;

    const json = await algoliaQuery<unknown>(params);
    const hits = json.results?.[0]?.hits ?? [];
    if (hits.length === 0) break;
    collected.push(...hits);
    page += 1;
  }

  return collected;
}

export async function fetchYcCompanies(): Promise<YcCompany[]> {
  const batchFacets = await fetchBatchFacets();
  const batchEntries = Object.entries(batchFacets);
  const expectedTotal = batchEntries.reduce((acc, [, count]) => acc + count, 0);

  console.log(
    `[yc-api] Fetching ${expectedTotal} companies across ${batchEntries.length} batches from Algolia.`,
  );

  const limit = pLimit(BATCH_FETCH_CONCURRENCY);
  const batchResults = await Promise.all(
    batchEntries.map(([batch, count]) =>
      limit(async () => {
        const hits = await fetchBatchCompanies(batch, count);
        console.log(`[yc-api]   ${batch}: ${hits.length}/${count}`);
        return hits;
      }),
    ),
  );

  const seen = new Set<number>();
  const companies: YcCompany[] = [];

  for (const rawCompany of batchResults.flat()) {
    const parsed = ycCompanySchema.safeParse(rawCompany);
    if (!parsed.success) continue;
    if (seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);

    const batchSlug = slugifyBatch(parsed.data.batch ?? "Unspecified");
    companies.push({
      id: parsed.data.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      former_names: parsed.data.former_names,
      small_logo_thumb_url: parsed.data.small_logo_thumb_url ?? null,
      website: parsed.data.website ?? null,
      all_locations: parsed.data.all_locations ?? null,
      long_description: parsed.data.long_description ?? null,
      one_liner: parsed.data.one_liner ?? null,
      team_size: parsed.data.team_size ?? null,
      highlight_black: parsed.data.highlight_black,
      highlight_latinx: parsed.data.highlight_latinx,
      highlight_women: parsed.data.highlight_women,
      industry: parsed.data.industry ?? null,
      subindustry: parsed.data.subindustry ?? null,
      launched_at: parsed.data.launched_at ?? null,
      tags: parsed.data.tags,
      top_company: parsed.data.top_company,
      isHiring: parsed.data.isHiring,
      nonprofit: parsed.data.nonprofit,
      batch: parsed.data.batch ?? null,
      status: parsed.data.status ?? null,
      industries: parsed.data.industries,
      regions: parsed.data.regions,
      stage: parsed.data.stage ?? null,
      app_video_public: parsed.data.app_video_public,
      demo_day_video_public: parsed.data.demo_day_video_public,
      question_answers: parsed.data.question_answers,
      url: `https://www.ycombinator.com/companies/${parsed.data.slug}`,
      api: `https://yc-oss.github.io/api/batches/${batchSlug}/${parsed.data.slug}.json`,
    });
  }

  companies.sort((a, b) => a.id - b.id);
  console.log(`[yc-api] Parsed ${companies.length} unique companies.`);
  return companies;
}
