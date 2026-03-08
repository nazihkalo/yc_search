export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  former_names TEXT NOT NULL DEFAULT '[]',
  small_logo_thumb_url TEXT,
  website TEXT,
  all_locations TEXT,
  long_description TEXT,
  one_liner TEXT,
  team_size INTEGER,
  highlight_black INTEGER NOT NULL DEFAULT 0,
  highlight_latinx INTEGER NOT NULL DEFAULT 0,
  highlight_women INTEGER NOT NULL DEFAULT 0,
  industry TEXT,
  subindustry TEXT,
  launched_at INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  top_company INTEGER NOT NULL DEFAULT 0,
  is_hiring INTEGER NOT NULL DEFAULT 0,
  nonprofit INTEGER NOT NULL DEFAULT 0,
  batch TEXT,
  status TEXT,
  industries TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  stage TEXT,
  app_video_public INTEGER NOT NULL DEFAULT 0,
  demo_day_video_public INTEGER NOT NULL DEFAULT 0,
  question_answers INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  api TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  company_hash TEXT NOT NULL DEFAULT '',
  needs_scrape INTEGER NOT NULL DEFAULT 1,
  needs_website_scrape INTEGER NOT NULL DEFAULT 1,
  needs_yc_profile_scrape INTEGER NOT NULL DEFAULT 1,
  needs_embed INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_snapshots (
  company_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'crawl4ai',
  website_url TEXT,
  content_markdown TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  error TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, source),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_embeddings (
  company_id INTEGER PRIMARY KEY,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS query_embeddings (
  query_hash TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  yc_total INTEGER,
  yc_inserted INTEGER,
  yc_updated INTEGER,
  yc_unchanged INTEGER,
  scrape_requested INTEGER,
  scrape_success INTEGER,
  scrape_failed INTEGER,
  scrape_changed INTEGER,
  scrape_unchanged INTEGER,
  website_scrape_requested INTEGER,
  website_scrape_success INTEGER,
  website_scrape_failed INTEGER,
  website_scrape_changed INTEGER,
  website_scrape_unchanged INTEGER,
  yc_profile_scrape_requested INTEGER,
  yc_profile_scrape_success INTEGER,
  yc_profile_scrape_failed INTEGER,
  yc_profile_scrape_changed INTEGER,
  yc_profile_scrape_unchanged INTEGER,
  embed_requested INTEGER,
  embed_success INTEGER,
  embed_skipped INTEGER,
  error TEXT
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS needs_website_scrape INTEGER NOT NULL DEFAULT 1;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS needs_yc_profile_scrape INTEGER NOT NULL DEFAULT 1;

ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS website_scrape_requested INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS website_scrape_success INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS website_scrape_failed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS website_scrape_changed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS website_scrape_unchanged INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS yc_profile_scrape_requested INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS yc_profile_scrape_success INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS yc_profile_scrape_failed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS yc_profile_scrape_changed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS yc_profile_scrape_unchanged INTEGER;

CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies(batch);
CREATE INDEX IF NOT EXISTS idx_companies_launched_at ON companies(launched_at);
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(stage);
CREATE INDEX IF NOT EXISTS idx_companies_is_hiring ON companies(is_hiring);
CREATE INDEX IF NOT EXISTS idx_companies_nonprofit ON companies(nonprofit);
CREATE INDEX IF NOT EXISTS idx_companies_top_company ON companies(top_company);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_needs_scrape ON companies(needs_scrape);
CREATE INDEX IF NOT EXISTS idx_companies_needs_website_scrape ON companies(needs_website_scrape);
CREATE INDEX IF NOT EXISTS idx_companies_needs_yc_profile_scrape ON companies(needs_yc_profile_scrape);
CREATE INDEX IF NOT EXISTS idx_companies_needs_embed ON companies(needs_embed);
CREATE INDEX IF NOT EXISTS idx_snapshots_company_id ON website_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_content_hash ON website_snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_hash ON company_embeddings(source_hash);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_updated_at ON query_embeddings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
`;
