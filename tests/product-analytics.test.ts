import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copilotQuestion,
  assistantRunOutcome,
  redactAnalyticsProperties,
  questionMetadata,
  sanitizeAnalyticsUrl,
} from "../lib/analytics/events";

test("question telemetry uses bounded categories and never returns input text", () => {
  const secret = "Summarize fintech vendors for secret-client@example.com";
  const metadata = questionMetadata(secret);
  assert.equal(metadata.intent, "summary");
  assert.equal(metadata.summary_type, "vendors");
  assert.deepEqual(metadata.topics, ["fintech"]);
  assert.equal(metadata.question_length, secret.length);
  assert.ok(!JSON.stringify(metadata).includes("secret-client"));
  assert.equal(
    questionMetadata("Compare AI developer tools").intent,
    "comparison",
  );
  assert.deepEqual(questionMetadata("Compare AI developer tools").topics, [
    "ai",
    "developer_tools",
  ]);
  assert.equal(questionMetadata("Summarize W24").summary_type, "batch");
});

test("URLs exclude query strings and fragments including nested return URLs", () => {
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://ycsearch.com/dashboard?q=private&thread=id#secret",
    ),
    "https://ycsearch.com/dashboard",
  );
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://ycsearch.com/sign-in?redirect_url=https%3A%2F%2Fycsearch.com%2F%3Fq%3Dsecret",
    ),
    "https://ycsearch.com/sign-in",
  );
  assert.equal(sanitizeAnalyticsUrl("invalid"), "");
});

test("Copilot counts user turns, excluding info, restores, connections, and tool continuations", () => {
  const messages = [{ id: "q1", role: "user", content: "Find AI companies" }];
  assert.deepEqual(
    copilotQuestion({ method: "agent/run", body: { messages } }),
    { id: "q1", text: "Find AI companies" },
  );
  for (const method of ["info", "agent/connect", "agent/stop"])
    assert.equal(copilotQuestion({ method, body: { messages } }), null);
  assert.equal(
    copilotQuestion({
      method: "agent/run",
      body: { messages: [...messages, { role: "tool", content: "done" }] },
    }),
    null,
  );
  assert.equal(
    copilotQuestion({
      method: "agent/run",
      body: { messages: [{ role: "user", content: "no stable id" }] },
    }),
    null,
  );
  assert.equal(copilotQuestion(null), null);
});

test("SDK attribution and person URL properties are removed without losing useful fields", () => {
  const properties = {
    $current_url: "https://ycsearch.com?q=secret",
    $referrer: "secret",
    utm_term: "secret",
    question_id: "q1",
    $set_once: { $initial_current_url: "secret", signed_up_at: "2026-11-22" },
    $set: { $initial_referrer: "secret" },
  };
  assert.deepEqual(redactAnalyticsProperties(properties), {
    question_id: "q1",
    $set_once: { signed_up_at: "2026-11-22" },
    $set: {},
  });
  assert.equal(properties.$set_once.$initial_current_url, "secret");
});

test("only nonempty assistant text counts as a final answer", () => {
  assert.equal(
    assistantRunOutcome([
      { role: "assistant", content: "Here are the companies." },
    ]),
    "answer",
  );
  assert.equal(
    assistantRunOutcome([
      { role: "assistant", content: "Looking", toolCalls: [{}] },
    ]),
    "tool_handoff",
  );
  assert.equal(
    assistantRunOutcome([{ role: "tool", content: "company result" }]),
    "tool_handoff",
  );
  assert.equal(
    assistantRunOutcome([{ role: "user", content: "Find companies" }]),
    "empty",
  );
  assert.equal(
    assistantRunOutcome([{ role: "assistant", content: "  " }]),
    "empty",
  );
});
