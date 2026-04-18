import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query } from "../lib/db";
import { getExaApiKey, getSyncExaLimit } from "../lib/env";
import {
  FOUNDER_BACKGROUND_SCHEMA,
  type FounderBackground,
  classifyMentionKind,
  exaSearch,
} from "../lib/exa";

type FounderRow = {
  id: number;
  full_name: string;
  company_name: string;
  company_one_liner: string | null;
  top_company: number;
  batch: string | null;
};

function parseLimitArg(defaultLimit: number): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultLimit;
}

function parseCompanyIdArg(): number | null {
  const argument = process.argv.find((value) => value.startsWith("--company-id="));
  if (!argument) return null;
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function buildQuery(row: FounderRow): string {
  const oneLiner = row.company_one_liner ? ` (${row.company_one_liner})` : "";
  return `${row.full_name}, co-founder of ${row.company_name}${oneLiner}`;
}

export type ExaEnrichSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  mentionsAdded: number;
  backgroundsFetched: number;
  totalCostDollars: number;
  skippedNoKey: boolean;
};

export async function enrichFoundersExa(options?: { limit?: number; companyId?: number | null }): Promise<ExaEnrichSummary> {
  await initializeDatabase();

  const apiKey = getExaApiKey();
  if (!apiKey) {
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      mentionsAdded: 0,
      backgroundsFetched: 0,
      totalCostDollars: 0,
      skippedNoKey: true,
    };
  }

  const batchLimit = options?.limit ?? parseLimitArg(getSyncExaLimit());
  const companyId = options?.companyId ?? parseCompanyIdArg();

  const candidates = companyId
    ? await query<FounderRow>(`
        SELECT f.id, f.full_name, c.name AS company_name, c.one_liner AS company_one_liner, c.top_company, c.batch
        FROM founders f
        INNER JOIN companies c ON c.id = f.company_id
        WHERE c.id = @company_id
        ORDER BY f.id ASC
      `, { company_id: companyId })
    : await query<FounderRow>(`
        SELECT f.id, f.full_name, c.name AS company_name, c.one_liner AS company_one_liner, c.top_company, c.batch
        FROM founders f
        INNER JOIN companies c ON c.id = f.company_id
        WHERE f.needs_exa_enrich = 1
        ORDER BY c.top_company DESC, f.id ASC
        LIMIT @limit
      `, { limit: batchLimit });

  if (candidates.length === 0) {
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      mentionsAdded: 0,
      backgroundsFetched: 0,
      totalCostDollars: 0,
      skippedNoKey: false,
    };
  }

  const limit = pLimit(4);
  let successCount = 0;
  let failureCount = 0;
  let mentionsAdded = 0;
  let backgroundsFetched = 0;
  let totalCostDollars = 0;

  await Promise.all(
    candidates.map((founder) =>
      limit(async () => {
        try {
          const response = await exaSearch<FounderBackground>(buildQuery(founder), {
            type: "auto",
            category: "people",
            numResults: 8,
            contents: {
              highlights: { maxCharacters: 2000, query: `${founder.full_name} work history education` },
            },
            outputSchema: FOUNDER_BACKGROUND_SCHEMA,
          });
          const costDollars = response.costDollars?.total ?? 0;
          totalCostDollars += costDollars;

          for (const result of response.results ?? []) {
            if (!result.url) continue;
            const kind = classifyMentionKind(result.url, result.title);
            const inserted = await execute(`
              INSERT INTO founder_mentions (
                founder_id, url, title, excerpt, kind, source, published_at, discovered_at, updated_at
              ) VALUES (
                @founder_id, @url, @title, @excerpt, @kind, 'exa', @published_at, NOW(), NOW()
              )
              ON CONFLICT (founder_id, url) DO UPDATE SET
                title = COALESCE(EXCLUDED.title, founder_mentions.title),
                excerpt = COALESCE(EXCLUDED.excerpt, founder_mentions.excerpt),
                kind = EXCLUDED.kind,
                published_at = COALESCE(EXCLUDED.published_at, founder_mentions.published_at),
                updated_at = NOW()
            `, {
              founder_id: founder.id,
              url: result.url,
              title: result.title,
              excerpt: result.text ? result.text.slice(0, 1200) : null,
              kind,
              published_at: result.publishedDate ? new Date(result.publishedDate).toISOString() : null,
            });
            if (inserted > 0) {
              mentionsAdded += 1;
            }
          }

          if (response.output?.content) {
            await execute(`
              UPDATE founders
              SET background = @background::jsonb,
                  background_fetched_at = NOW(),
                  updated_at = NOW()
              WHERE id = @id
            `, {
              id: founder.id,
              background: JSON.stringify(response.output.content),
            });
            backgroundsFetched += 1;
          }

          await execute(`
            UPDATE founders
            SET needs_exa_enrich = 0,
                last_enriched_at = NOW(),
                updated_at = NOW()
            WHERE id = @id
          `, { id: founder.id });

          await execute(`
            UPDATE companies
            SET needs_embed = 1, updated_at = NOW()
            WHERE id = (SELECT company_id FROM founders WHERE id = @id)
          `, { id: founder.id });

          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Exa enrichment failed for founder ${founder.id} (${founder.full_name}): ${message}`);
          failureCount += 1;
        }
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('founders_exa_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    requested: candidates.length,
    successCount,
    failureCount,
    mentionsAdded,
    backgroundsFetched,
    totalCostDollars,
    skippedNoKey: false,
  };
}

async function main() {
  const summary = await enrichFoundersExa();
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDb();
    });
}
