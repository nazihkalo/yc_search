export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

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
  needs_embed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_snapshots (
  company_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'crawl4ai',
  website_url TEXT,
  content_markdown TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  error TEXT,
  scraped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, source),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_embeddings (
  company_id INTEGER PRIMARY KEY,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  embedded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies(batch);
CREATE INDEX IF NOT EXISTS idx_companies_launched_at ON companies(launched_at);
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(stage);
CREATE INDEX IF NOT EXISTS idx_companies_is_hiring ON companies(is_hiring);
CREATE INDEX IF NOT EXISTS idx_companies_nonprofit ON companies(nonprofit);
CREATE INDEX IF NOT EXISTS idx_companies_top_company ON companies(top_company);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_needs_scrape ON companies(needs_scrape);
CREATE INDEX IF NOT EXISTS idx_companies_needs_embed ON companies(needs_embed);
CREATE INDEX IF NOT EXISTS idx_snapshots_company_id ON website_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_content_hash ON website_snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_hash ON company_embeddings(source_hash);
`;
