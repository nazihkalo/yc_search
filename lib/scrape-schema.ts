export const SCRAPE_BUDGET_SCHEMA = `
CREATE TABLE IF NOT EXISTS scrape_proxy_budget (
  month TEXT PRIMARY KEY,
  reserved_bytes BIGINT NOT NULL DEFAULT 0,
  measured_bytes BIGINT NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scrape_proxy_requests (
  id UUID PRIMARY KEY,
  month TEXT NOT NULL REFERENCES scrape_proxy_budget(month),
  reserved_bytes BIGINT NOT NULL,
  measured_bytes BIGINT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
