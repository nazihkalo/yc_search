import { closeDb } from "../lib/db";
import { getSyncEmbedLimit, getSyncScrapeLimit } from "../lib/env";
import { runIncrementalSync } from "../lib/sync-job";

async function main() {
  const summary = await runIncrementalSync({
    trigger: "cron",
    scrapeLimit: getSyncScrapeLimit(),
    embedLimit: getSyncEmbedLimit(),
  });

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok && summary.reason === "already_running") {
    return;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
