import "dotenv/config";

import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SYNC_TOKEN: z.string().optional(),
  SQLITE_IMPORT_PATH: z.string().optional(),
  SYNC_SCRAPE_LIMIT: z.string().optional(),
  SYNC_EMBED_LIMIT: z.string().optional(),
});

function parseBaseEnv() {
  return baseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SYNC_TOKEN: process.env.SYNC_TOKEN,
    SQLITE_IMPORT_PATH: process.env.SQLITE_IMPORT_PATH,
    SYNC_SCRAPE_LIMIT: process.env.SYNC_SCRAPE_LIMIT,
    SYNC_EMBED_LIMIT: process.env.SYNC_EMBED_LIMIT,
  });
}

export function getEnv() {
  return parseBaseEnv();
}

export function getCrawl4AiPythonBin() {
  const value = process.env.CRAWL4AI_PYTHON_BIN?.trim();
  return value && value.length > 0 ? value : "python3";
}

export function getCrawl4AiPageTimeoutMs() {
  const raw = process.env.CRAWL4AI_PAGE_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 35_000;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getSyncScrapeLimit() {
  return parsePositiveInt(process.env.SYNC_SCRAPE_LIMIT, 25);
}

export function getSyncEmbedLimit() {
  return parsePositiveInt(process.env.SYNC_EMBED_LIMIT, 50);
}

export function getOpenAiApiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return value;
}

export function getSqliteImportPath() {
  const value = process.env.SQLITE_IMPORT_PATH?.trim();
  return value && value.length > 0 ? value : "./data/yc_search.sqlite";
}

export type AppEnv = ReturnType<typeof getEnv>;
