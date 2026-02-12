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

export function getFirecrawlApiKey() {
  const value = process.env.FIRECRAWL_API_KEY;
  if (!value) {
    throw new Error("FIRECRAWL_API_KEY is required");
  }
  return value;
}

export function getOpenAiApiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return value;
}

export type AppEnv = ReturnType<typeof getEnv>;
