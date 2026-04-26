import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";

import { getOpenAiApiKey } from "../../../lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: getOpenAiApiKey() });
  const serviceAdapter = new OpenAIAdapter({ openai, model: "gpt-4o-mini" });

  // CopilotKit's `actions` config is client-side-only — handlers passed here
  // are silently replaced with `Promise.resolve()`. So we keep this empty and
  // register every tool (including `askKnowledgeBase` / `lookupCompany`) on
  // the client via `useCopilotAction`, where their handlers fetch
  // dedicated server endpoints.
  const copilotKit = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotKit,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
