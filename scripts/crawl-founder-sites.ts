import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { scrapeWebsiteMarkdown } from "../lib/crawl4ai";
import { closeDb, execute, initializeDatabase, query } from "../lib/db";
import { getSyncFounderSiteCrawlLimit } from "../lib/env";
import { sha256 } from "../lib/hash";

type FounderSiteRow = {
  id: number;
  full_name: string;
  personal_site_url: string;
};

function parseLimitArg(defaultLimit: number): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultLimit;
}

export type FounderSiteCrawlSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  changedContentCount: number;
  unchangedContentCount: number;
};

export async function crawlFounderSites(options?: { limit?: number }): Promise<FounderSiteCrawlSummary> {
  await initializeDatabase();
  const source = "personal_site";

  const batchLimit = options?.limit ?? parseLimitArg(getSyncFounderSiteCrawlLimit());
  const candidates = await query<FounderSiteRow>(`
      SELECT id, full_name, personal_site_url
      FROM founders
      WHERE needs_site_crawl = 1
        AND personal_site_url IS NOT NULL
        AND TRIM(personal_site_url) != ''
      ORDER BY id ASC
      LIMIT @limit
    `, { limit: batchLimit });

  if (candidates.length === 0) {
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      changedContentCount: 0,
      unchangedContentCount: 0,
    };
  }

  const limit = pLimit(4);
  let successCount = 0;
  let failureCount = 0;
  let changedContentCount = 0;
  let unchangedContentCount = 0;

  await Promise.all(
    candidates.map((founder) =>
      limit(async () => {
        const url = founder.personal_site_url.trim();
        try {
          const markdown = await scrapeWebsiteMarkdown(url);
          const contentHash = sha256(markdown);

          const previous = await query<{ content_hash: string }>(`
            SELECT content_hash FROM founder_snapshots
            WHERE founder_id = @id AND source = @source AND url = @url
          `, { id: founder.id, source, url });

          const contentChanged = previous.length === 0 || previous[0].content_hash !== contentHash;

          await execute(`
            INSERT INTO founder_snapshots (
              founder_id, source, url, content_markdown, content_hash, error, scraped_at, updated_at
            ) VALUES (@founder_id, @source, @url, @content_markdown, @content_hash, NULL, NOW(), NOW())
            ON CONFLICT (founder_id, source, url) DO UPDATE SET
              content_markdown = EXCLUDED.content_markdown,
              content_hash = EXCLUDED.content_hash,
              error = NULL,
              scraped_at = NOW(),
              updated_at = NOW()
          `, {
            founder_id: founder.id,
            source,
            url,
            content_markdown: markdown,
            content_hash: contentHash,
          });

          await execute(`
            UPDATE founders
            SET needs_site_crawl = 0,
                last_enriched_at = NOW(),
                updated_at = NOW()
            WHERE id = @id
          `, { id: founder.id });

          successCount += 1;
          if (contentChanged) {
            changedContentCount += 1;
            await execute(`
              UPDATE companies
              SET needs_embed = 1, updated_at = NOW()
              WHERE id = (SELECT company_id FROM founders WHERE id = @id)
            `, { id: founder.id });
          } else {
            unchangedContentCount += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await execute(`
            INSERT INTO founder_snapshots (
              founder_id, source, url, content_markdown, content_hash, error, scraped_at, updated_at
            ) VALUES (@founder_id, @source, @url, '', '', @error, NOW(), NOW())
            ON CONFLICT (founder_id, source, url) DO UPDATE SET
              error = EXCLUDED.error,
              scraped_at = NOW(),
              updated_at = NOW()
          `, {
            founder_id: founder.id,
            source,
            url,
            error: message,
          });
          await execute(`
            UPDATE founders
            SET needs_site_crawl = 0, updated_at = NOW()
            WHERE id = @id
          `, { id: founder.id });
          failureCount += 1;
        }
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('founders_site_crawl_last_sync_at', @value, NOW())
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
  const summary = await crawlFounderSites();
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
