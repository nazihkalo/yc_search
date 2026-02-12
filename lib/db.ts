import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { SCHEMA_SQL } from "../db/schema";

let dbInstance: Database.Database | null = null;
let initialized = false;

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
