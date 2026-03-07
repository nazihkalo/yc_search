import { pathToFileURL } from "node:url";

import { buildCompanySearchText } from "../lib/company-normalize";
import { closeDb, execute, initializeDatabase, query, withTransaction } from "../lib/db";
import { sha256 } from "../lib/hash";
import { fetchYcCompanies } from "../lib/yc-api";

type ExistingCompanyRow = {
  id: number;
  company_hash: string;
};

export type SyncYcSummary = {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
};

export async function syncYcCompanies(): Promise<SyncYcSummary> {
  await initializeDatabase();
  const companies = await fetchYcCompanies();
  const existingRows = await query<ExistingCompanyRow>("SELECT id, company_hash FROM companies");
  const existingHashById = new Map(
    existingRows.map((row: ExistingCompanyRow) => [row.id, row.company_hash]),
  );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  await withTransaction(async (client) => {
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

      await execute(`
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
          NOW()
        )
        ON CONFLICT(id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          former_names = EXCLUDED.former_names,
          small_logo_thumb_url = EXCLUDED.small_logo_thumb_url,
          website = EXCLUDED.website,
          all_locations = EXCLUDED.all_locations,
          long_description = EXCLUDED.long_description,
          one_liner = EXCLUDED.one_liner,
          team_size = EXCLUDED.team_size,
          highlight_black = EXCLUDED.highlight_black,
          highlight_latinx = EXCLUDED.highlight_latinx,
          highlight_women = EXCLUDED.highlight_women,
          industry = EXCLUDED.industry,
          subindustry = EXCLUDED.subindustry,
          launched_at = EXCLUDED.launched_at,
          tags = EXCLUDED.tags,
          top_company = EXCLUDED.top_company,
          is_hiring = EXCLUDED.is_hiring,
          nonprofit = EXCLUDED.nonprofit,
          batch = EXCLUDED.batch,
          status = EXCLUDED.status,
          industries = EXCLUDED.industries,
          regions = EXCLUDED.regions,
          stage = EXCLUDED.stage,
          app_video_public = EXCLUDED.app_video_public,
          demo_day_video_public = EXCLUDED.demo_day_video_public,
          question_answers = EXCLUDED.question_answers,
          url = EXCLUDED.url,
          api = EXCLUDED.api,
          search_text = EXCLUDED.search_text,
          company_hash = EXCLUDED.company_hash,
          needs_scrape = EXCLUDED.needs_scrape,
          needs_embed = EXCLUDED.needs_embed,
          updated_at = NOW()
      `, {
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
      }, client);
    }

    await execute(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES (@key, @value, NOW())
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `, {
      key: "yc_last_sync_at",
      value: new Date().toISOString(),
    }, client);

    await execute(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES (@key, @value, NOW())
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `, {
      key: "yc_company_count",
      value: String(companies.length),
    }, client);
  });

  return {
    total: companies.length,
    inserted,
    updated,
    unchanged,
  };
}

async function main() {
  const summary = await syncYcCompanies();
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
