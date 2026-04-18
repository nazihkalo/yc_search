import { pathToFileURL } from "node:url";

import { closeDb, execute, initializeDatabase, query } from "../lib/db";
import { upsertFoundersForCompany } from "../lib/founders";
import { YC_PROFILE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";
import { parseYcCompanyProfileSnapshotMarkdown } from "../lib/yc-company-page";

type CandidateRow = {
  id: number;
  top_company: number;
  content_markdown: string;
};

function parseLimitArg(defaultLimit = 0): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : defaultLimit;
}

export type ExtractFoundersSummary = {
  companiesProcessed: number;
  foundersExtracted: number;
  foundersUpserted: number;
  foundersFlaggedForGithub: number;
  foundersFlaggedForSiteCrawl: number;
  foundersFlaggedForExa: number;
};

export async function extractFounders(options?: { limit?: number; companyId?: number | null }): Promise<ExtractFoundersSummary> {
  await initializeDatabase();

  const companyIdFilter = options?.companyId ?? null;
  const effectiveLimit = options?.limit ?? parseLimitArg();
  const limitClause = (!companyIdFilter && effectiveLimit > 0)
    ? `LIMIT ${Math.floor(effectiveLimit)}`
    : "";
  const whereClause = companyIdFilter ? "AND c.id = @company_id" : "";

  const candidates = await query<CandidateRow>(`
      SELECT c.id, c.top_company, s.content_markdown
      FROM companies c
      INNER JOIN website_snapshots s
        ON s.company_id = c.id AND s.source = @source
      WHERE s.content_markdown IS NOT NULL
        AND s.content_markdown <> ''
        ${whereClause}
      ORDER BY c.id ASC
      ${limitClause}
    `, companyIdFilter
      ? { source: YC_PROFILE_SNAPSHOT_SOURCE, company_id: companyIdFilter }
      : { source: YC_PROFILE_SNAPSHOT_SOURCE });

  let foundersExtracted = 0;
  let foundersUpserted = 0;
  let foundersFlaggedForGithub = 0;
  let foundersFlaggedForSiteCrawl = 0;
  let foundersFlaggedForExa = 0;

  for (const candidate of candidates) {
    const { founders } = parseYcCompanyProfileSnapshotMarkdown(candidate.content_markdown);
    if (founders.length === 0) {
      continue;
    }

    foundersExtracted += founders.length;

    const stats = await upsertFoundersForCompany({
      companyId: candidate.id,
      topCompany: Boolean(candidate.top_company),
      founders,
    });
    foundersUpserted += stats.foundersUpserted;
    foundersFlaggedForGithub += stats.foundersFlaggedForGithub;
    foundersFlaggedForSiteCrawl += stats.foundersFlaggedForSiteCrawl;
    foundersFlaggedForExa += stats.foundersFlaggedForExa;
  }

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('founders_extract_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    companiesProcessed: candidates.length,
    foundersExtracted,
    foundersUpserted,
    foundersFlaggedForGithub,
    foundersFlaggedForSiteCrawl,
    foundersFlaggedForExa,
  };
}

async function main() {
  const summary = await extractFounders();
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
