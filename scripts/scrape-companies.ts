import pLimit from "p-limit";

import { getDb, initializeDatabase } from "../lib/db";
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

async function main() {
  initializeDatabase();
  const db = getDb();
  const source = ACTIVE_SNAPSHOT_SOURCE;

  const batchLimit = parseLimitArg();
  const candidates = db
    .prepare<[{ limit: number }], ScrapeCandidate>(`
      SELECT id, name, website
      FROM companies
      WHERE needs_scrape = 1
        AND website IS NOT NULL
        AND TRIM(website) != ''
      ORDER BY id ASC
      LIMIT @limit
    `)
    .all({ limit: batchLimit });

  if (candidates.length === 0) {
    console.log("No companies need scraping.");
    return;
  }

  const limit = pLimit(8);
  const upsertSnapshot = db.prepare(`
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
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(company_id, source) DO UPDATE SET
      website_url = excluded.website_url,
      content_markdown = excluded.content_markdown,
      content_hash = excluded.content_hash,
      source = excluded.source,
      error = excluded.error,
      scraped_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `);

  const completeSuccess = db.prepare(`
    UPDATE companies
    SET
      needs_scrape = 0,
      needs_embed = @needs_embed,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const failedScrape = db.prepare(`
    UPDATE companies
    SET
      needs_scrape = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

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

          const previous = db
            .prepare<[{ id: number; source: string }], { content_hash: string }>(
              `
                SELECT content_hash
                FROM website_snapshots
                WHERE company_id = @id AND source = @source
              `,
            )
            .get({ id: candidate.id, source });

          const contentChanged = !previous || previous.content_hash !== contentHash;

          upsertSnapshot.run({
            company_id: candidate.id,
            website_url: website,
            content_markdown: markdown,
            content_hash: contentHash,
            source,
            error: null,
          });

          completeSuccess.run({
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
          upsertSnapshot.run({
            company_id: candidate.id,
            website_url: website,
            content_markdown: "",
            content_hash: "",
            source,
            error: errorMessage,
          });
          failedScrape.run({ id: candidate.id });
          failureCount += 1;
        }
      }),
    ),
  );

  db.prepare(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('scrape_last_sync_at', @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run({ value: new Date().toISOString() });

  console.log(
    JSON.stringify(
      {
        requested: candidates.length,
        successCount,
        failureCount,
        changedContentCount,
        unchangedContentCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
