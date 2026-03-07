import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { closeDb, execute, initializeDatabase, withTransaction } from "../lib/db";
import { getSqliteImportPath } from "../lib/env";

type CompanyRow = {
  id: number;
  name: string;
  slug: string | null;
  former_names: string;
  small_logo_thumb_url: string | null;
  website: string | null;
  all_locations: string | null;
  long_description: string | null;
  one_liner: string | null;
  team_size: number | null;
  highlight_black: number;
  highlight_latinx: number;
  highlight_women: number;
  industry: string | null;
  subindustry: string | null;
  launched_at: number | null;
  tags: string;
  top_company: number;
  is_hiring: number;
  nonprofit: number;
  batch: string | null;
  status: string | null;
  industries: string;
  regions: string;
  stage: string | null;
  app_video_public: number;
  demo_day_video_public: number;
  question_answers: number;
  url: string | null;
  api: string | null;
  search_text: string;
  company_hash: string;
  needs_scrape: number;
  needs_embed: number;
  created_at: string | null;
  updated_at: string | null;
};

type SnapshotRow = {
  company_id: number;
  source: string | null;
  website_url: string | null;
  content_markdown: string;
  content_hash: string;
  error: string | null;
  scraped_at: string | null;
  updated_at: string | null;
};

type EmbeddingRow = {
  company_id: number;
  model: string;
  dimensions: number;
  vector: string;
  source_hash: string;
  embedded_at: string | null;
  updated_at: string | null;
};

type SyncStateRow = {
  key: string;
  value: string;
  updated_at: string | null;
};

function resolveSqliteImportPath() {
  const fromArg = process.argv.find((value) => value.startsWith("--from="))?.split("=")[1];
  const rawPath = fromArg || getSqliteImportPath();
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

async function main() {
  const sqlitePath = resolveSqliteImportPath();
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite import file not found: ${sqlitePath}`);
  }

  await initializeDatabase();

  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    const companies = sqlite.prepare<[], CompanyRow>("SELECT * FROM companies").all();
    const snapshots = sqlite.prepare<[], SnapshotRow>("SELECT * FROM website_snapshots").all();
    const embeddings = sqlite.prepare<[], EmbeddingRow>("SELECT * FROM company_embeddings").all();
    const syncStates = sqlite.prepare<[], SyncStateRow>("SELECT * FROM sync_state").all();

    await withTransaction(async (client) => {
      for (const row of companies) {
        await execute(
          `
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
              created_at,
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
              COALESCE(@created_at, NOW()::text)::timestamptz,
              COALESCE(@updated_at, NOW()::text)::timestamptz
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
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
          `,
          row,
          client,
        );
      }

      for (const row of snapshots) {
        await execute(
          `
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
              COALESCE(@scraped_at, NOW()::text)::timestamptz,
              COALESCE(@updated_at, NOW()::text)::timestamptz
            )
            ON CONFLICT(company_id, source) DO UPDATE SET
              website_url = EXCLUDED.website_url,
              content_markdown = EXCLUDED.content_markdown,
              content_hash = EXCLUDED.content_hash,
              error = EXCLUDED.error,
              scraped_at = EXCLUDED.scraped_at,
              updated_at = EXCLUDED.updated_at
          `,
          {
            ...row,
            source: row.source || "crawl4ai",
          },
          client,
        );
      }

      for (const row of embeddings) {
        await execute(
          `
            INSERT INTO company_embeddings (
              company_id,
              model,
              dimensions,
              vector,
              source_hash,
              embedded_at,
              updated_at
            ) VALUES (
              @company_id,
              @model,
              @dimensions,
              @vector,
              @source_hash,
              COALESCE(@embedded_at, NOW()::text)::timestamptz,
              COALESCE(@updated_at, NOW()::text)::timestamptz
            )
            ON CONFLICT(company_id) DO UPDATE SET
              model = EXCLUDED.model,
              dimensions = EXCLUDED.dimensions,
              vector = EXCLUDED.vector,
              source_hash = EXCLUDED.source_hash,
              embedded_at = EXCLUDED.embedded_at,
              updated_at = EXCLUDED.updated_at
          `,
          row,
          client,
        );
      }

      for (const row of syncStates) {
        await execute(
          `
            INSERT INTO sync_state (key, value, updated_at)
            VALUES (
              @key,
              @value,
              COALESCE(@updated_at, NOW()::text)::timestamptz
            )
            ON CONFLICT(key) DO UPDATE SET
              value = EXCLUDED.value,
              updated_at = EXCLUDED.updated_at
          `,
          row,
          client,
        );
      }
    });

    console.log(
      JSON.stringify(
        {
          sqlitePath,
          imported: {
            companies: companies.length,
            websiteSnapshots: snapshots.length,
            companyEmbeddings: embeddings.length,
            syncStates: syncStates.length,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    sqlite.close();
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
