import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query, queryOne } from "../lib/db";
import { sha256 } from "../lib/hash";
import { YC_PROFILE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";
import { fetchYcCompanyProfileSnapshot } from "../lib/yc-company-page";

type ScrapeCandidate = {
  id: number;
  name: string;
  url: string | null;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function renderProgressBar(completed: number, total: number, width = 20) {
  if (total <= 0) {
    return `[${"-".repeat(width)}]`;
  }
  const ratio = Math.max(0, Math.min(1, completed / total));
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}]`;
}

function parseLimitArg(defaultLimit = 500): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
}

export type YcProfileScrapeSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  changedContentCount: number;
  unchangedContentCount: number;
};

export async function scrapeYcCompanyPages(options?: { limit?: number }): Promise<YcProfileScrapeSummary> {
  await initializeDatabase();
  const source = YC_PROFILE_SNAPSHOT_SOURCE;

  const batchLimit = options?.limit ?? parseLimitArg();
  const candidates = await query<ScrapeCandidate>(`
      SELECT id, name, url
      FROM companies
      WHERE needs_yc_profile_scrape = 1
        AND url IS NOT NULL
        AND TRIM(url) != ''
      ORDER BY id ASC
      LIMIT @limit
    `, { limit: batchLimit });

  if (candidates.length === 0) {
    console.log("No YC company pages need scraping.");
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      changedContentCount: 0,
      unchangedContentCount: 0,
    };
  }

  const limit = pLimit(6);
  let successCount = 0;
  let failureCount = 0;
  let changedContentCount = 0;
  let unchangedContentCount = 0;
  let completedCount = 0;
  const startedAtMs = Date.now();
  const totalCount = candidates.length;

  const printProgress = (force = false) => {
    const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
    const rate = completedCount > 0 ? completedCount / Math.max(elapsedSeconds, 0.001) : 0;
    const remaining = Math.max(0, totalCount - completedCount);
    const etaSeconds = rate > 0 ? remaining / rate : Number.NaN;
    const percent = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;
    const line = [
      `yc-profile ${renderProgressBar(completedCount, totalCount)}`,
      `${completedCount}/${totalCount}`,
      `(${percent.toFixed(1)}%)`,
      `ok:${successCount}`,
      `fail:${failureCount}`,
      `changed:${changedContentCount}`,
      `unchanged:${unchangedContentCount}`,
      `eta:${formatDuration(etaSeconds)}`,
    ].join("  ");

    if (process.stdout.isTTY) {
      process.stdout.write(`\r${line.padEnd(140)}`);
      if (force) {
        process.stdout.write("\n");
      }
      return;
    }

    if (force || completedCount === totalCount || completedCount % 25 === 0) {
      console.log(line);
    }
  };

  printProgress();

  await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        const profileUrl = candidate.url?.trim();
        if (!profileUrl) {
          completedCount += 1;
          failureCount += 1;
          printProgress();
          return;
        }

        try {
          const snapshot = await fetchYcCompanyProfileSnapshot(profileUrl);
          const contentHash = sha256(snapshot.markdown);

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
            website_url: profileUrl,
            content_markdown: snapshot.markdown,
            content_hash: contentHash,
            source,
            error: null,
          });

          await execute(`
            UPDATE companies
            SET
              needs_scrape = needs_website_scrape,
              needs_yc_profile_scrape = 0,
              updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });

          if (contentChanged) {
            await execute(`
              UPDATE companies
              SET needs_embed = 1, updated_at = NOW()
              WHERE id = @id
            `, { id: candidate.id });
          }

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
              website_url = COALESCE(EXCLUDED.website_url, website_snapshots.website_url),
              error = EXCLUDED.error,
              scraped_at = NOW(),
              updated_at = NOW()
          `, {
            company_id: candidate.id,
            website_url: profileUrl,
            content_markdown: "",
            content_hash: "",
            source,
            error: errorMessage,
          });

          await execute(`
            UPDATE companies
            SET
              needs_scrape = CASE
                WHEN needs_website_scrape = 1 THEN 1
                ELSE needs_yc_profile_scrape
              END,
              updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });

          failureCount += 1;
        } finally {
          completedCount += 1;
          printProgress();
        }
      }),
    ),
  );

  printProgress(true);

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('yc_profile_scrape_last_sync_at', @value, NOW())
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
  const summary = await scrapeYcCompanyPages();
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
