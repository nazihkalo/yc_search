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

CREATE TABLE IF NOT EXISTS founders (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  github_url TEXT,
  personal_site_url TEXT,
  wikipedia_url TEXT,
  image_url TEXT,
  source TEXT NOT NULL DEFAULT 'yc_profile',
  needs_github_enrich INTEGER NOT NULL DEFAULT 0,
  needs_site_crawl INTEGER NOT NULL DEFAULT 0,
  needs_exa_enrich INTEGER NOT NULL DEFAULT 0,
  last_enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, full_name),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS founder_snapshots (
  founder_id BIGINT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  error TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (founder_id, source, url),
  FOREIGN KEY (founder_id) REFERENCES founders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS founder_github (
  founder_id BIGINT PRIMARY KEY,
  github_username TEXT NOT NULL,
  name TEXT,
  bio TEXT,
  company TEXT,
  location TEXT,
  blog TEXT,
  public_repos INTEGER,
  followers INTEGER,
  following INTEGER,
  top_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_repos JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (founder_id) REFERENCES founders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS founder_mentions (
  id BIGSERIAL PRIMARY KEY,
  founder_id BIGINT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  excerpt TEXT,
  kind TEXT NOT NULL DEFAULT 'other',
  source TEXT NOT NULL DEFAULT 'exa',
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (founder_id, url),
  FOREIGN KEY (founder_id) REFERENCES founders(id) ON DELETE CASCADE
);

ALTER TABLE founders ADD COLUMN IF NOT EXISTS background JSONB;
ALTER TABLE founders ADD COLUMN IF NOT EXISTS background_fetched_at TIMESTAMPTZ;

ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS founders_upserted INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS founders_extracted INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS github_enriched INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS github_failed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS founder_sites_crawled INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS founder_sites_failed INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS exa_founders_queried INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS exa_mentions_added INTEGER;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS exa_backgrounds_fetched INTEGER;

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

CREATE INDEX IF NOT EXISTS idx_founders_company_id ON founders(company_id);
CREATE INDEX IF NOT EXISTS idx_founders_needs_github_enrich ON founders(needs_github_enrich);
CREATE INDEX IF NOT EXISTS idx_founders_needs_site_crawl ON founders(needs_site_crawl);
CREATE INDEX IF NOT EXISTS idx_founders_needs_exa_enrich ON founders(needs_exa_enrich);
CREATE INDEX IF NOT EXISTS idx_founder_snapshots_founder_id ON founder_snapshots(founder_id);
CREATE INDEX IF NOT EXISTS idx_founder_mentions_founder_id ON founder_mentions(founder_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  image_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  cost_units INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_endpoint_created ON usage_events(endpoint, created_at DESC);
`;
