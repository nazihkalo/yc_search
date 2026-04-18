import { closeDb, queryOne } from "../lib/db";

async function main() {
  const companyCounts = await queryOne<{
    total: string | number;
    with_yc_profile: string | number;
    pending_yc_profile_scrape: string | number;
  }>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE needs_yc_profile_scrape = 0) AS with_yc_profile,
      COUNT(*) FILTER (WHERE needs_yc_profile_scrape = 1) AS pending_yc_profile_scrape
    FROM companies
  `);

  const profileSnapshotCount = await queryOne<{ count: string | number }>(
    "SELECT COUNT(*) AS count FROM website_snapshots WHERE source = 'yc_profile'",
  );

  const founderCounts = await queryOne<{
    total: string | number;
    with_background: string | number;
    pending_exa: string | number;
    with_github_url: string | number;
    with_personal_site: string | number;
  }>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE background IS NOT NULL) AS with_background,
      COUNT(*) FILTER (WHERE needs_exa_enrich = 1) AS pending_exa,
      COUNT(*) FILTER (WHERE github_url IS NOT NULL) AS with_github_url,
      COUNT(*) FILTER (WHERE personal_site_url IS NOT NULL) AS with_personal_site
    FROM founders
  `);

  console.log("Companies:", companyCounts);
  console.log("YC profile snapshots:", profileSnapshotCount);
  console.log("Founders:", founderCounts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
