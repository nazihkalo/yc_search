import pLimit from "p-limit";

import { scrapeWebsiteMarkdown } from "../lib/crawl4ai";
import { getDb, initializeDatabase } from "../lib/db";
import { sha256 } from "../lib/hash";

type CandidateRow = {
  id: number;
  name: string;
  website: string;
};

function parseLimitArg(defaultLimit = 2): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultLimit;
}

async function main() {
  initializeDatabase();
  const db = getDb();
  const requestedLimit = parseLimitArg(2);
  const source = "crawl4ai";

  const candidates = db
    .prepare<[{ limit: number }], CandidateRow>(`
      SELECT
        c.id,
        c.name,
        c.website
      FROM companies c
      WHERE c.website IS NOT NULL
        AND TRIM(c.website) != ''
        AND (
          c.batch LIKE 'W26%'
          OR c.batch LIKE 'S26%'
          OR c.batch LIKE '%2026%'
        )
      ORDER BY RANDOM()
      LIMIT @limit
    `)
    .all({ limit: requestedLimit });

  if (candidates.length === 0) {
    console.log(
      JSON.stringify(
        {
          requestedLimit,
          selected: 0,
          message: "No eligible 2026 companies with websites were found.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const upsertSnapshot = db.prepare(`
    INSERT INTO website_snapshots (
      company_id,
      source,
      website_url,
      content_markdown,
      content_hash,
      error,
      scraped_at,
      updated_at
    ) VALUES (
      @company_id,
      @source,
      @website_url,
      @content_markdown,
      @content_hash,
      @error,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(company_id, source) DO UPDATE SET
      website_url = excluded.website_url,
      content_markdown = excluded.content_markdown,
      content_hash = excluded.content_hash,
      error = excluded.error,
      scraped_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `);

  const previousHashStatement = db.prepare<[{ id: number; source: string }], { content_hash: string }>(
    `
      SELECT content_hash
      FROM website_snapshots
      WHERE company_id = @id AND source = @source
      LIMIT 1
    `,
  );

  const markNeedsEmbed = db.prepare(`
    UPDATE companies
    SET needs_embed = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const limit = pLimit(2);
  const results = await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        const markdown = await scrapeWebsiteMarkdown(candidate.website);
        const contentHash = sha256(markdown);
        const previousHash = previousHashStatement.get({ id: candidate.id, source })?.content_hash ?? "";
        const changed = previousHash !== contentHash;

        upsertSnapshot.run({
          company_id: candidate.id,
          source,
          website_url: candidate.website,
          content_markdown: markdown,
          content_hash: contentHash,
          error: null,
        });

        if (changed) {
          markNeedsEmbed.run({ id: candidate.id });
        }

        return {
          id: candidate.id,
          name: candidate.name,
          website: candidate.website,
          companyPage: `/companies/${candidate.id}`,
          crawl4aiLength: markdown.length,
          crawl4aiChanged: changed,
        };
      }),
    ),
  );

  console.log(
    JSON.stringify(
      {
        requestedLimit,
        selected: candidates.length,
        source,
        results,
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
