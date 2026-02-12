import { buildCompanySearchText } from "../lib/company-normalize";
import { getDb, initializeDatabase } from "../lib/db";
import { sha256 } from "../lib/hash";
import { fetchYcCompanies } from "../lib/yc-api";

type ExistingCompanyRow = {
  id: number;
  company_hash: string;
};

async function main() {
  initializeDatabase();
  const db = getDb();

  const companies = await fetchYcCompanies();

  const existingRows = db
    .prepare<[], ExistingCompanyRow>("SELECT id, company_hash FROM companies")
    .all();
  const existingHashById = new Map(
    existingRows.map((row: ExistingCompanyRow) => [row.id, row.company_hash]),
  );

  const upsertStatement = db.prepare(`
    INSERT INTO companies (
      id,
      name,
      slug,
      former_names,
      small_logo_thumb_url,
      website,
      all_locations,
      long_description,
      one_liner,
      team_size,
      highlight_black,
      highlight_latinx,
      highlight_women,
      industry,
      subindustry,
      launched_at,
      tags,
      top_company,
      is_hiring,
      nonprofit,
      batch,
      status,
      industries,
      regions,
      stage,
      app_video_public,
      demo_day_video_public,
      question_answers,
      url,
      api,
      search_text,
      company_hash,
      needs_scrape,
      needs_embed,
      updated_at
    ) VALUES (
      @id,
      @name,
      @slug,
      @former_names,
      @small_logo_thumb_url,
      @website,
      @all_locations,
      @long_description,
      @one_liner,
      @team_size,
      @highlight_black,
      @highlight_latinx,
      @highlight_women,
      @industry,
      @subindustry,
      @launched_at,
      @tags,
      @top_company,
      @is_hiring,
      @nonprofit,
      @batch,
      @status,
      @industries,
      @regions,
      @stage,
      @app_video_public,
      @demo_day_video_public,
      @question_answers,
      @url,
      @api,
      @search_text,
      @company_hash,
      @needs_scrape,
      @needs_embed,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      former_names = excluded.former_names,
      small_logo_thumb_url = excluded.small_logo_thumb_url,
      website = excluded.website,
      all_locations = excluded.all_locations,
      long_description = excluded.long_description,
      one_liner = excluded.one_liner,
      team_size = excluded.team_size,
      highlight_black = excluded.highlight_black,
      highlight_latinx = excluded.highlight_latinx,
      highlight_women = excluded.highlight_women,
      industry = excluded.industry,
      subindustry = excluded.subindustry,
      launched_at = excluded.launched_at,
      tags = excluded.tags,
      top_company = excluded.top_company,
      is_hiring = excluded.is_hiring,
      nonprofit = excluded.nonprofit,
      batch = excluded.batch,
      status = excluded.status,
      industries = excluded.industries,
      regions = excluded.regions,
      stage = excluded.stage,
      app_video_public = excluded.app_video_public,
      demo_day_video_public = excluded.demo_day_video_public,
      question_answers = excluded.question_answers,
      url = excluded.url,
      api = excluded.api,
      search_text = excluded.search_text,
      company_hash = excluded.company_hash,
      needs_scrape = excluded.needs_scrape,
      needs_embed = excluded.needs_embed,
      updated_at = CURRENT_TIMESTAMP
  `);

  const setSyncState = db.prepare(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES (@key, @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  const writeTransaction = db.transaction(() => {
    for (const company of companies) {
      const companyHashPayload = {
        name: company.name,
        slug: company.slug,
        former_names: company.former_names,
        website: company.website ?? null,
        all_locations: company.all_locations ?? null,
        long_description: company.long_description ?? null,
        one_liner: company.one_liner ?? null,
        team_size: company.team_size ?? null,
        highlight_black: company.highlight_black,
        highlight_latinx: company.highlight_latinx,
        highlight_women: company.highlight_women,
        industry: company.industry ?? null,
        subindustry: company.subindustry ?? null,
        launched_at: company.launched_at ?? null,
        tags: company.tags,
        top_company: company.top_company,
        isHiring: company.isHiring,
        nonprofit: company.nonprofit,
        batch: company.batch ?? null,
        status: company.status ?? null,
        industries: company.industries,
        regions: company.regions,
        stage: company.stage ?? null,
        app_video_public: company.app_video_public,
        demo_day_video_public: company.demo_day_video_public,
        question_answers: company.question_answers,
        url: company.url ?? null,
        api: company.api ?? null,
      };
      const companyHash = sha256(JSON.stringify(companyHashPayload));

      const existingHash = existingHashById.get(company.id);
      const isNew = !existingHash;
      const changed = existingHash !== companyHash;

      if (isNew) {
        inserted += 1;
      } else if (changed) {
        updated += 1;
      } else {
        unchanged += 1;
      }

      upsertStatement.run({
        id: company.id,
        name: company.name,
        slug: company.slug,
        former_names: JSON.stringify(company.former_names),
        small_logo_thumb_url: company.small_logo_thumb_url ?? null,
        website: company.website ?? null,
        all_locations: company.all_locations ?? null,
        long_description: company.long_description ?? null,
        one_liner: company.one_liner ?? null,
        team_size: company.team_size ?? null,
        highlight_black: company.highlight_black ? 1 : 0,
        highlight_latinx: company.highlight_latinx ? 1 : 0,
        highlight_women: company.highlight_women ? 1 : 0,
        industry: company.industry ?? null,
        subindustry: company.subindustry ?? null,
        launched_at: company.launched_at ?? null,
        tags: JSON.stringify(company.tags),
        top_company: company.top_company ? 1 : 0,
        is_hiring: company.isHiring ? 1 : 0,
        nonprofit: company.nonprofit ? 1 : 0,
        batch: company.batch ?? null,
        status: company.status ?? null,
        industries: JSON.stringify(company.industries),
        regions: JSON.stringify(company.regions),
        stage: company.stage ?? null,
        app_video_public: company.app_video_public ? 1 : 0,
        demo_day_video_public: company.demo_day_video_public ? 1 : 0,
        question_answers: company.question_answers ? 1 : 0,
        url: company.url ?? null,
        api: company.api ?? null,
        search_text: buildCompanySearchText(company),
        company_hash: companyHash,
        needs_scrape: isNew || changed ? 1 : 0,
        needs_embed: isNew || changed ? 1 : 0,
      });
    }

    setSyncState.run({
      key: "yc_last_sync_at",
      value: new Date().toISOString(),
    });

    setSyncState.run({
      key: "yc_company_count",
      value: String(companies.length),
    });
  });

  writeTransaction();

  console.log(
    JSON.stringify(
      {
        total: companies.length,
        inserted,
        updated,
        unchanged,
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
