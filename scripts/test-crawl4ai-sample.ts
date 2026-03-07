import pLimit from "p-limit";

import { scrapeWebsiteMarkdown } from "../lib/crawl4ai";
import { closeDb, execute, initializeDatabase, query, queryOne } from "../lib/db";
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
  await initializeDatabase();
  const requestedLimit = parseLimitArg(2);
  const source = "crawl4ai";

  const candidates = await query<CandidateRow>(`
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
    `, { limit: requestedLimit });

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

  const limit = pLimit(2);
  const results = await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        const markdown = await scrapeWebsiteMarkdown(candidate.website);
        const contentHash = sha256(markdown);
        const previous = await queryOne<{ content_hash: string }>(
          `
            SELECT content_hash
            FROM website_snapshots
            WHERE company_id = @id AND source = @source
            LIMIT 1
          `,
          { id: candidate.id, source },
        );
        const previousHash = previous?.content_hash ?? "";
        const changed = previousHash !== contentHash;

        await execute(`
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
            NOW(),
            NOW()
          )
          ON CONFLICT(company_id, source) DO UPDATE SET
            website_url = EXCLUDED.website_url,
            content_markdown = EXCLUDED.content_markdown,
            content_hash = EXCLUDED.content_hash,
            error = EXCLUDED.error,
            scraped_at = NOW(),
            updated_at = NOW()
        `, {
          company_id: candidate.id,
          source,
          website_url: candidate.website,
          content_markdown: markdown,
          content_hash: contentHash,
          error: null,
        });

        if (changed) {
          await execute(`
            UPDATE companies
            SET needs_embed = 1, updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
