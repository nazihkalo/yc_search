// Kept separate so discovery can migrate without running unrelated legacy DDL.
export const COMPANY_DISCOVERY_SCHEMA = `
CREATE SEQUENCE IF NOT EXISTS discovered_company_id_seq START -1 INCREMENT -1 MINVALUE -499999999 MAXVALUE -1;
CREATE TABLE IF NOT EXISTS company_list_sources (
  url TEXT PRIMARY KEY,
  publisher TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hub', 'list')),
  discovered_from TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  content_hash TEXT,
  title TEXT,
  list_year INTEGER,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_list_due ON company_list_sources(next_check_at);
CREATE TABLE IF NOT EXISTS company_list_documents (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL REFERENCES company_list_sources(url),
  content_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  extracted JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_url, content_hash, extractor_version)
);
CREATE TABLE IF NOT EXISTS company_profile_websites (
  profile_url TEXT PRIMARY KEY,
  website TEXT,
  evidence TEXT,
  content_hash TEXT,
  checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS company_discovery_identities (
  profile_url TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS company_list_memberships (
  source_url TEXT NOT NULL REFERENCES company_list_sources(url),
  member_key TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  website TEXT,
  profile_url TEXT,
  rank INTEGER,
  evidence TEXT NOT NULL,
  document_id BIGINT NOT NULL REFERENCES company_list_documents(id),
  resolution TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(source_url, member_key)
);
ALTER TABLE company_list_memberships ADD COLUMN IF NOT EXISTS profile_url TEXT;
CREATE INDEX IF NOT EXISTS idx_company_list_member_company ON company_list_memberships(company_id);
CREATE TABLE IF NOT EXISTS company_discovery_state (
  key TEXT PRIMARY KEY,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS company_discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  summary JSONB,
  error TEXT
);
`;
