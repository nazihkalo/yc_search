import { advisoryUnlock, execute, initializeDatabase, query, queryOne, tryAdvisoryLock, withConnection } from "./db";
import { getSyncEmbedLimit, getSyncRunTimeoutMs, getSyncScrapeLimit } from "./env";
import { embedCompanies, type EmbedSummary } from "../scripts/embed-companies";
import { scrapeCompanies, type ScrapeSummary } from "../scripts/scrape-companies";
import { scrapeYcCompanyPages, type YcProfileScrapeSummary } from "../scripts/scrape-yc-company-pages";
import { syncYcCompanies, type SyncYcSummary } from "../scripts/sync-yc";

const SYNC_LOCK_KEY = "yc_search_incremental_sync";

type SyncRunRow = {
  id: number;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  yc_total: number | null;
  yc_inserted: number | null;
  yc_updated: number | null;
  yc_unchanged: number | null;
  scrape_requested: number | null;
  scrape_success: number | null;
  scrape_failed: number | null;
  scrape_changed: number | null;
  scrape_unchanged: number | null;
  website_scrape_requested: number | null;
  website_scrape_success: number | null;
  website_scrape_failed: number | null;
  website_scrape_changed: number | null;
  website_scrape_unchanged: number | null;
  yc_profile_scrape_requested: number | null;
  yc_profile_scrape_success: number | null;
  yc_profile_scrape_failed: number | null;
  yc_profile_scrape_changed: number | null;
  yc_profile_scrape_unchanged: number | null;
  embed_requested: number | null;
  embed_success: number | null;
  embed_skipped: number | null;
  error: string | null;
};

function combineScrapeSummaries(website: ScrapeSummary, ycProfile: YcProfileScrapeSummary): ScrapeSummary {
  return {
    requested: website.requested + ycProfile.requested,
    successCount: website.successCount + ycProfile.successCount,
    failureCount: website.failureCount + ycProfile.failureCount,
    changedContentCount: website.changedContentCount + ycProfile.changedContentCount,
    unchangedContentCount: website.unchangedContentCount + ycProfile.unchangedContentCount,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export type SyncRunSummary =
  | {
      ok: true;
      status: "success";
      runId: number;
      trigger: string;
      startedAt: string;
      finishedAt: string;
      scrapeLimit: number;
      embedLimit: number;
      yc: SyncYcSummary;
      scrape: ScrapeSummary;
      websiteScrape: ScrapeSummary;
      ycProfileScrape: YcProfileScrapeSummary;
      embed: EmbedSummary;
    }
  | {
      ok: false;
      status: "skipped";
      reason: "already_running";
      runningRunId: number | null;
      scrapeLimit: number;
      embedLimit: number;
    };

export async function runIncrementalSync(options?: {
  trigger?: string;
  scrapeLimit?: number;
  embedLimit?: number;
}): Promise<SyncRunSummary> {
  await initializeDatabase();

  const trigger = options?.trigger ?? "manual";
  const scrapeLimit = options?.scrapeLimit ?? getSyncScrapeLimit();
  const embedLimit = options?.embedLimit ?? getSyncEmbedLimit();
  const runTimeoutMs = getSyncRunTimeoutMs();

  return withConnection(async (client) => {
    const locked = await tryAdvisoryLock(SYNC_LOCK_KEY, client);
    if (!locked) {
      const running = await queryOne<{ id: number }>(
        `
          SELECT id
          FROM sync_runs
          WHERE status = 'running'
          ORDER BY started_at DESC
          LIMIT 1
        `,
      );
      return {
        ok: false,
        status: "skipped",
        reason: "already_running",
        runningRunId: running?.id ?? null,
        scrapeLimit,
        embedLimit,
      };
    }

    try {
      const inserted = await queryOne<{ id: number; started_at: string }>(
        `
          INSERT INTO sync_runs (trigger, status, started_at)
          VALUES (@trigger, 'running', NOW())
          RETURNING id, started_at
        `,
        { trigger },
      );

      if (!inserted) {
        throw new Error("Failed to create sync run record.");
      }

      try {
        const { yc, websiteScrape, ycProfileScrape, scrape, embed } = await withTimeout(
          (async () => {
            const ycResult = await syncYcCompanies();
            const websiteScrapeResult = await scrapeCompanies({ limit: scrapeLimit });
            const ycProfileScrapeResult = await scrapeYcCompanyPages({ limit: scrapeLimit });
            const scrapeResult = combineScrapeSummaries(websiteScrapeResult, ycProfileScrapeResult);
            const embedResult = await embedCompanies({ limit: embedLimit });
            return {
              yc: ycResult,
              websiteScrape: websiteScrapeResult,
              ycProfileScrape: ycProfileScrapeResult,
              scrape: scrapeResult,
              embed: embedResult,
            };
          })(),
          runTimeoutMs,
          "Incremental sync run",
        );

        const finished = await queryOne<{ finished_at: string }>(
          `
            UPDATE sync_runs
            SET
              status = 'success',
              finished_at = NOW(),
              yc_total = @yc_total,
              yc_inserted = @yc_inserted,
              yc_updated = @yc_updated,
              yc_unchanged = @yc_unchanged,
              scrape_requested = @scrape_requested,
              scrape_success = @scrape_success,
              scrape_failed = @scrape_failed,
              scrape_changed = @scrape_changed,
              scrape_unchanged = @scrape_unchanged,
              website_scrape_requested = @website_scrape_requested,
              website_scrape_success = @website_scrape_success,
              website_scrape_failed = @website_scrape_failed,
              website_scrape_changed = @website_scrape_changed,
              website_scrape_unchanged = @website_scrape_unchanged,
              yc_profile_scrape_requested = @yc_profile_scrape_requested,
              yc_profile_scrape_success = @yc_profile_scrape_success,
              yc_profile_scrape_failed = @yc_profile_scrape_failed,
              yc_profile_scrape_changed = @yc_profile_scrape_changed,
              yc_profile_scrape_unchanged = @yc_profile_scrape_unchanged,
              embed_requested = @embed_requested,
              embed_success = @embed_success,
              embed_skipped = @embed_skipped,
              error = NULL
            WHERE id = @id
            RETURNING finished_at
          `,
          {
            id: inserted.id,
            yc_total: yc.total,
            yc_inserted: yc.inserted,
            yc_updated: yc.updated,
            yc_unchanged: yc.unchanged,
            scrape_requested: scrape.requested,
            scrape_success: scrape.successCount,
            scrape_failed: scrape.failureCount,
            scrape_changed: scrape.changedContentCount,
            scrape_unchanged: scrape.unchangedContentCount,
            website_scrape_requested: websiteScrape.requested,
            website_scrape_success: websiteScrape.successCount,
            website_scrape_failed: websiteScrape.failureCount,
            website_scrape_changed: websiteScrape.changedContentCount,
            website_scrape_unchanged: websiteScrape.unchangedContentCount,
            yc_profile_scrape_requested: ycProfileScrape.requested,
            yc_profile_scrape_success: ycProfileScrape.successCount,
            yc_profile_scrape_failed: ycProfileScrape.failureCount,
            yc_profile_scrape_changed: ycProfileScrape.changedContentCount,
            yc_profile_scrape_unchanged: ycProfileScrape.unchangedContentCount,
            embed_requested: embed.requested,
            embed_success: embed.embeddedCount,
            embed_skipped: embed.skippedCount,
          },
        );

        return {
          ok: true,
          status: "success",
          runId: inserted.id,
          trigger,
          startedAt: inserted.started_at,
          finishedAt: finished?.finished_at ?? new Date().toISOString(),
          scrapeLimit,
          embedLimit,
          yc,
          scrape,
          websiteScrape,
          ycProfileScrape,
          embed,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await execute(
          `
            UPDATE sync_runs
            SET status = 'failed', finished_at = NOW(), error = @error
            WHERE id = @id
          `,
          { id: inserted.id, error: message },
        );
        throw error;
      }
    } finally {
      await advisoryUnlock(SYNC_LOCK_KEY, client);
    }
  });
}

export async function getLatestSyncStatus() {
  await initializeDatabase();

  const [latestRun, syncStateRows, backlog] = await Promise.all([
    queryOne<SyncRunRow>(
      `
        SELECT
          id,
          trigger,
          status,
          started_at,
          finished_at,
          yc_total,
          yc_inserted,
          yc_updated,
          yc_unchanged,
          scrape_requested,
          scrape_success,
          scrape_failed,
          scrape_changed,
          scrape_unchanged,
          website_scrape_requested,
          website_scrape_success,
          website_scrape_failed,
          website_scrape_changed,
          website_scrape_unchanged,
          yc_profile_scrape_requested,
          yc_profile_scrape_success,
          yc_profile_scrape_failed,
          yc_profile_scrape_changed,
          yc_profile_scrape_unchanged,
          embed_requested,
          embed_success,
          embed_skipped,
          error
        FROM sync_runs
        ORDER BY started_at DESC
        LIMIT 1
      `,
    ),
    query<{ key: string; value: string; updated_at: string }>(
      `
        SELECT key, value, updated_at
        FROM sync_state
      `,
    ),
    queryOne<{
      pending_scrape: string | number;
      pending_website_scrape: string | number;
      pending_yc_profile_scrape: string | number;
      pending_embed: string | number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE needs_website_scrape = 1 OR needs_yc_profile_scrape = 1) AS pending_scrape,
          COUNT(*) FILTER (WHERE needs_website_scrape = 1) AS pending_website_scrape,
          COUNT(*) FILTER (WHERE needs_yc_profile_scrape = 1) AS pending_yc_profile_scrape,
          COUNT(*) FILTER (WHERE needs_embed = 1) AS pending_embed
        FROM companies
      `,
    ),
  ]);

  return {
    latestRun,
    backlog: {
      pendingScrape: Number(backlog?.pending_scrape ?? 0),
      pendingWebsiteScrape: Number(backlog?.pending_website_scrape ?? 0),
      pendingYcProfileScrape: Number(backlog?.pending_yc_profile_scrape ?? 0),
      pendingEmbed: Number(backlog?.pending_embed ?? 0),
    },
    syncState: Object.fromEntries(
      syncStateRows.map((row) => [
        row.key,
        {
          value: row.value,
          updatedAt: row.updated_at,
        },
      ]),
    ),
  };
}
