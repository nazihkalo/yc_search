import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query, queryOne } from "../lib/db";
import { scrapeWebsiteMarkdown } from "../lib/crawl4ai";
import { sha256 } from "../lib/hash";
import { ACTIVE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";

type ScrapeCandidate = {
  id: number;
  name: string;
  website: string | null;
};

function parseLimitArg(defaultLimit = 500): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
}

export type ScrapeSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  changedContentCount: number;
  unchangedContentCount: number;
};

export async function scrapeCompanies(options?: { limit?: number }): Promise<ScrapeSummary> {
  await initializeDatabase();
  const source = ACTIVE_SNAPSHOT_SOURCE;

  const batchLimit = options?.limit ?? parseLimitArg();
  const candidates = await query<ScrapeCandidate>(`
      SELECT id, name, website
      FROM companies
      WHERE needs_scrape = 1
        AND website IS NOT NULL
        AND TRIM(website) != ''
      ORDER BY id ASC
      LIMIT @limit
    `, { limit: batchLimit });

  if (candidates.length === 0) {
    console.log("No companies need scraping.");
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      changedContentCount: 0,
      unchangedContentCount: 0,
    };
  }

  const limit = pLimit(8);
  let successCount = 0;
  let failureCount = 0;
  let changedContentCount = 0;
  let unchangedContentCount = 0;

  await Promise.all(
    candidates.map((candidate: ScrapeCandidate) =>
      limit(async () => {
        const website = candidate.website?.trim();
        if (!website) {
          return;
        }

        try {
          const markdown = await scrapeWebsiteMarkdown(website);
          const contentHash = sha256(markdown);

          const previous = await queryOne<{ content_hash: string }>(`
            SELECT content_hash
            FROM website_snapshots
            WHERE company_id = @id AND source = @source
          `, { id: candidate.id, source });

          const contentChanged = !previous || previous.content_hash !== contentHash;

          await execute(`
            INSERT INTO website_snapshots (
              company_id,
              website_url,
              content_markdown,
              content_hash,
              source,
              error,
              scraped_at,
              updated_at
            ) VALUES (
              @company_id,
              @website_url,
              @content_markdown,
              @content_hash,
              @source,
              @error,
              NOW(),
              NOW()
            )
            ON CONFLICT(company_id, source) DO UPDATE SET
              website_url = EXCLUDED.website_url,
              content_markdown = EXCLUDED.content_markdown,
              content_hash = EXCLUDED.content_hash,
              source = EXCLUDED.source,
              error = EXCLUDED.error,
              scraped_at = NOW(),
              updated_at = NOW()
          `, {
            company_id: candidate.id,
            website_url: website,
            content_markdown: markdown,
            content_hash: contentHash,
            source,
            error: null,
          });

          await execute(`
            UPDATE companies
            SET
              needs_scrape = 0,
              needs_embed = @needs_embed,
              updated_at = NOW()
            WHERE id = @id
          `, {
            id: candidate.id,
            needs_embed: contentChanged ? 1 : 0,
          });

          successCount += 1;
          if (contentChanged) {
            changedContentCount += 1;
          } else {
            unchangedContentCount += 1;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await execute(`
            INSERT INTO website_snapshots (
              company_id,
              website_url,
              content_markdown,
              content_hash,
              source,
              error,
              scraped_at,
              updated_at
            ) VALUES (
              @company_id,
              @website_url,
              @content_markdown,
              @content_hash,
              @source,
              @error,
              NOW(),
              NOW()
            )
            ON CONFLICT(company_id, source) DO UPDATE SET
              website_url = EXCLUDED.website_url,
              content_markdown = EXCLUDED.content_markdown,
              content_hash = EXCLUDED.content_hash,
              source = EXCLUDED.source,
              error = EXCLUDED.error,
              scraped_at = NOW(),
              updated_at = NOW()
          `, {
            company_id: candidate.id,
            website_url: website,
            content_markdown: "",
            content_hash: "",
            source,
            error: errorMessage,
          });
          await execute(`
            UPDATE companies
            SET
              needs_scrape = 1,
              updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });
          failureCount += 1;
        }
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('scrape_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    requested: candidates.length,
    successCount,
    failureCount,
    changedContentCount,
    unchangedContentCount,
  };
}

async function main() {
  const summary = await scrapeCompanies();
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
