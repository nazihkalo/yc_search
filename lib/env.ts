import "dotenv/config";

import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_PATH: z.string().default("./data/yc_search.sqlite"),
  SYNC_TOKEN: z.string().optional(),
});

function parseBaseEnv() {
  return baseEnvSchema.parse({
    DATABASE_PATH: process.env.DATABASE_PATH,
    SYNC_TOKEN: process.env.SYNC_TOKEN,
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

export function getOpenAiApiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return value;
}

export type AppEnv = ReturnType<typeof getEnv>;
