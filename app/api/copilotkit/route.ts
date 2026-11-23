import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";

import { requirePlan, recordUsage } from "../../../lib/auth";
import { captureServerEvent } from "../../../lib/analytics/server";
import { copilotQuestion, questionMetadata } from "../../../lib/analytics/events";
import { getOpenAiApiKey } from "../../../lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, allowed } = await requirePlan("free");
  if (!allowed || !userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const question = copilotQuestion(await req.clone().json().catch(() => null));
  if (question) {
    recordUsage(userId, "api.copilotkit");
    captureServerEvent(userId, "question_submitted", { ...questionMetadata(question.text),
      question_id: question.id, $insert_id: `question:${userId}:${question.id}`, surface: "copilot" });
  }
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
