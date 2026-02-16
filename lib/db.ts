import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { SCHEMA_SQL } from "../db/schema";

let dbInstance: Database.Database | null = null;
let initialized = false;

function hasTable(db: Database.Database, tableName: string) {
  const row = db
    .prepare<[{ tableName: string }], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName LIMIT 1",
    )
    .get({ tableName });
  return Boolean(row);
}

function shouldMigrateWebsiteSnapshots(db: Database.Database) {
  if (!hasTable(db, "website_snapshots")) {
    return false;
  }

  const columns = db
    .prepare<[], { name: string; pk: number }>("PRAGMA table_info(website_snapshots)")
    .all();
  const companyIdPk = columns.find((column) => column.name === "company_id")?.pk ?? 0;
  const sourcePk = columns.find((column) => column.name === "source")?.pk ?? 0;

  // Legacy schema had company_id as the only primary key.
  return companyIdPk === 1 && sourcePk === 0;
}

function migrateWebsiteSnapshotsToMultiSource(db: Database.Database) {
  if (!shouldMigrateWebsiteSnapshots(db)) {
    return;
  }

  db.exec(`
    BEGIN;
    ALTER TABLE website_snapshots RENAME TO website_snapshots_legacy;
    CREATE TABLE website_snapshots (
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
    INSERT INTO website_snapshots (
      company_id,
      source,
      website_url,
      content_markdown,
      content_hash,
      error,
      scraped_at,
      updated_at
    )
    SELECT
      company_id,
      COALESCE(NULLIF(source, ''), 'crawl4ai') AS source,
      website_url,
      content_markdown,
      content_hash,
      error,
      scraped_at,
      updated_at
    FROM website_snapshots_legacy;
    DROP TABLE website_snapshots_legacy;
    COMMIT;
  `);
}

function resolveDatabasePath() {
  const configuredPath = process.env.DATABASE_PATH ?? "./data/yc_search.sqlite";
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

function ensureDatabaseDirectory(databasePath: string) {
  const dirPath = path.dirname(databasePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const databasePath = resolveDatabasePath();
  ensureDatabaseDirectory(databasePath);

  dbInstance = new Database(databasePath);
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("journal_mode = WAL");

  return dbInstance;
}

export function initializeDatabase() {
  if (initialized) {
    return;
  }

  const db = getDb();
  migrateWebsiteSnapshotsToMultiSource(db);
  db.exec(SCHEMA_SQL);
  initialized = true;
}

export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
