"use client";
import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { captureEvent } from "../../lib/analytics/client";
import {
  assistantRunOutcome,
  questionMetadata,
} from "../../lib/analytics/events";

/** Observe live agent lifecycle events; restoring saved messages emits none. */
export function ChatAnalytics() {
  const { agent } = useAgent();
  useEffect(() => {
    if (!agent) return;
    const started = new Map<string, number>();
    const completed = new Set<string>();
    const subscription = agent.subscribe({
      onRunInitialized: ({ input }) => {
        started.set(input.runId, Date.now());
      },
      onRunFinishedEvent: ({ input, messages }) => {
        if (completed.has(input.runId)) return;
        completed.add(input.runId);
        const question = [...messages].reverse().find((m) => m.role === "user");
        captureEvent("assistant_run_completed", {
          run_id: input.runId,
          $insert_id: `run-completed:${input.runId}`,
          question_id: question?.id,
          ...questionMetadata(
            typeof question?.content === "string" ? question.content : "",
          ),
          duration_ms: Date.now() - (started.get(input.runId) ?? Date.now()),
          outcome: assistantRunOutcome(messages),
          message_count: messages.length,
        });
        started.delete(input.runId);
      },
      onRunFailed: ({ input }) => {
        captureEvent("assistant_run_failed", {
          run_id: input.runId,
          $insert_id: `run-failed:${input.runId}`,
          reason: "transport_or_runtime",
        });
        started.delete(input.runId);
      },
      onRunErrorEvent: ({ input }) => {
        captureEvent("assistant_run_failed", {
          run_id: input.runId,
          $insert_id: `run-failed:${input.runId}`,
          reason: "agent_error",
        });
        started.delete(input.runId);
      },
    });
    return () => subscription.unsubscribe();
  }, [agent]);
  return null;
}
