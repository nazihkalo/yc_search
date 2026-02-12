import OpenAI from "openai";

import { getOpenAiApiKey } from "./env";

let client: OpenAI | null = null;

export function getOpenAiClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: getOpenAiApiKey(),
    });
  }
  return client;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
