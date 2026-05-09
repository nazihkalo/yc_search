import { pathToFileURL } from "node:url";

import {
  FORBES_AI50_2026_COMPANIES,
  FORBES_AI50_2026_SOURCE,
  type ForbesAi50CompanySeed,
} from "../lib/seeds/forbes-ai50-2026";
import { closeDb, execute, initializeDatabase, query, withTransaction } from "../lib/db";
import { sha256 } from "../lib/hash";

type ExistingCompanyRow = {
  id: number;
  company_hash: string;
};

export type SyncForbesAi50Summary = {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
};

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function forbesAi50CompanyId(slug: string) {
  const hashPrefix = sha256(`${FORBES_AI50_2026_SOURCE.kind}:${FORBES_AI50_2026_SOURCE.year}:${slug}`).slice(0, 8);
  const bucket = Number.parseInt(hashPrefix, 16) % 1_500_000_000;
  return -(500_000_000 + bucket);
}

function foundedYearToTimestamp(year: number) {
  return Math.floor(Date.UTC(year, 0, 1) / 1000);
}

function buildForbesSearchText(company: ForbesAi50CompanySeed) {
  return [
    company.name,
    company.oneLiner,
    company.category,
    company.city,
    company.country,
    company.funding,
    company.foundedYear,
    FORBES_AI50_2026_SOURCE.listName,
    String(FORBES_AI50_2026_SOURCE.year),
    ...company.tags,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLongDescription(company: ForbesAi50CompanySeed) {
  return [
    company.oneLiner,
    `Founded in ${company.foundedYear} in ${company.city}, ${company.country}.`,
    `Forbes listed funding: ${company.funding}.`,
  ].join(" ");
}

export async function syncForbesAi50Companies(): Promise<SyncForbesAi50Summary> {
  await initializeDatabase();

  const existingRows = await query<ExistingCompanyRow>(`
    SELECT id, company_hash
    FROM companies
    WHERE source_kind = @source_kind
  `, { source_kind: FORBES_AI50_2026_SOURCE.kind });
  const existingHashById = new Map(existingRows.map((row) => [row.id, row.company_hash]));

  const seenIds = new Set<number>();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  await withTransaction(async (client) => {
    for (const [index, company] of FORBES_AI50_2026_COMPANIES.entries()) {
      const id = forbesAi50CompanyId(company.slug);
      if (seenIds.has(id)) {
        throw new Error(`Duplicate Forbes AI 50 deterministic id for ${company.slug}: ${id}`);
      }
      seenIds.add(id);

      const allLocations = `${company.city}, ${company.country}`;
      const industries = ["Artificial Intelligence", company.category];
      const tags = ["Forbes AI 50", `Forbes AI 50 ${FORBES_AI50_2026_SOURCE.year}`, ...company.tags];
      const sourceRank = index + 1;
      const companyHashPayload = {
        name: company.name,
        slug: company.slug,
        website: company.website,
        all_locations: allLocations,
        long_description: buildLongDescription(company),
        one_liner: company.oneLiner,
        industry: company.category,
        subindustry: company.oneLiner,
        launched_at: foundedYearToTimestamp(company.foundedYear),
        tags,
        industries,
        regions: [company.country],
        source_kind: FORBES_AI50_2026_SOURCE.kind,
        source_url: FORBES_AI50_2026_SOURCE.url,
        source_rank: sourceRank,
        source_year: FORBES_AI50_2026_SOURCE.year,
        source_list_name: FORBES_AI50_2026_SOURCE.listName,
        founded_year: company.foundedYear,
        funding: company.funding,
      };
      const companyHash = sha256(JSON.stringify(companyHashPayload));
      const existingHash = existingHashById.get(id);
      const isNew = !existingHash;
      const changed = existingHash !== companyHash;
      const needsWebsiteScrape = (isNew || changed) && hasValue(company.website);
      const needsVendorEnrichment = needsWebsiteScrape;

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
          source_kind,
          source_url,
          source_rank,
          source_year,
          source_list_name,
          founded_year,
          funding,
          needs_scrape,
          needs_website_scrape,
          needs_yc_profile_scrape,
          needs_vendor_enrichment,
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
          @source_kind,
          @source_url,
          @source_rank,
          @source_year,
          @source_list_name,
          @founded_year,
          @funding,
          @needs_scrape,
          @needs_website_scrape,
          @needs_yc_profile_scrape,
          @needs_vendor_enrichment,
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
          source_kind = EXCLUDED.source_kind,
          source_url = EXCLUDED.source_url,
          source_rank = EXCLUDED.source_rank,
          source_year = EXCLUDED.source_year,
          source_list_name = EXCLUDED.source_list_name,
          founded_year = EXCLUDED.founded_year,
          funding = EXCLUDED.funding,
          needs_scrape = EXCLUDED.needs_scrape,
          needs_website_scrape = EXCLUDED.needs_website_scrape,
          needs_yc_profile_scrape = EXCLUDED.needs_yc_profile_scrape,
          needs_vendor_enrichment = CASE
            WHEN EXCLUDED.needs_vendor_enrichment = 1 THEN 1
            ELSE companies.needs_vendor_enrichment
          END,
          needs_embed = CASE
            WHEN EXCLUDED.needs_embed = 1 THEN 1
            ELSE companies.needs_embed
          END,
          updated_at = NOW()
      `, {
        id,
        name: company.name,
        slug: company.slug,
        former_names: JSON.stringify([]),
        small_logo_thumb_url: null,
        website: company.website,
        all_locations: allLocations,
        long_description: buildLongDescription(company),
        one_liner: company.oneLiner,
        team_size: null,
        highlight_black: 0,
        highlight_latinx: 0,
        highlight_women: 0,
        industry: company.category,
        subindustry: company.oneLiner,
        launched_at: foundedYearToTimestamp(company.foundedYear),
        tags: JSON.stringify(tags),
        top_company: 0,
        is_hiring: 0,
        nonprofit: 0,
        batch: null,
        status: "Active",
        industries: JSON.stringify(industries),
        regions: JSON.stringify([company.country]),
        stage: null,
        app_video_public: 0,
        demo_day_video_public: 0,
        question_answers: 0,
        url: null,
        api: null,
        search_text: buildForbesSearchText(company),
        company_hash: companyHash,
        source_kind: FORBES_AI50_2026_SOURCE.kind,
        source_url: FORBES_AI50_2026_SOURCE.url,
        source_rank: sourceRank,
        source_year: FORBES_AI50_2026_SOURCE.year,
        source_list_name: FORBES_AI50_2026_SOURCE.listName,
        founded_year: company.foundedYear,
        funding: company.funding,
        needs_scrape: needsWebsiteScrape ? 1 : 0,
        needs_website_scrape: needsWebsiteScrape ? 1 : 0,
        needs_yc_profile_scrape: 0,
        needs_vendor_enrichment: needsVendorEnrichment ? 1 : 0,
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
      key: "forbes_ai50_last_sync_at",
      value: new Date().toISOString(),
    }, client);

    await execute(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES (@key, @value, NOW())
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `, {
      key: "forbes_ai50_company_count",
      value: String(FORBES_AI50_2026_COMPANIES.length),
    }, client);
  });

  return {
    total: FORBES_AI50_2026_COMPANIES.length,
    inserted,
    updated,
    unchanged,
  };
}

async function main() {
  const summary = await syncForbesAi50Companies();
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
