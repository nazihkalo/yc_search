"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { gqlToAGUI, loadMessagesFromJsonRepresentation } from "@copilotkit/runtime-client-gql";

const SAVE_DEBOUNCE_MS = 800;

// CopilotKit 1.56 keeps the conversation on the v2 agent. The v1
// `useCopilotMessagesContext().messages` is a legacy state that nothing fills
// any more, so it stays `[]`. CopilotChat (react-ui) reads its messages from
// `useAgent()` with the provider's default agent id and thread id, and calling
// it here with no arguments resolves to that same agent instance.
type AgentMessage = { id?: string; role?: string; content?: unknown };

const RUNTIME_CONNECTED = "connected";

export function ChatPersistence() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadId = searchParams.get("thread");
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent();
  const messages = (agent?.messages ?? []) as AgentMessage[];
  // Before the runtime connects, `useAgent` hands back a provisional agent that
  // is swapped out once /info returns, so messages set on it would be lost.
  const runtimeReady = String(copilotkit.runtimeConnectionStatus) === RUNTIME_CONNECTED;

  // Synchronous guard — React state updates are async after `await`, so we
  // need a ref to reliably block the hydration effect from re-firing on a
  // threadId we just created locally.
  const hydratedRef = useRef<string | null>(null);
  const [hydratedThreadId, setHydratedThreadId] = useState<string | null>(null);

  const creatingRef = useRef(false);
  const [titleGenerated, setTitleGenerated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");

  // Hydrate messages from server when thread changes.
  useEffect(() => {
    if (!threadId) {
      hydratedRef.current = null;
      setHydratedThreadId(null);
      return;
    }
    if (!runtimeReady || !agent) return;
    if (hydratedRef.current === threadId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        if (cancelled) return;
        if (!res.ok) {
          // Thread doesn't exist or isn't owned — clear the URL param.
          if (res.status === 404) {
            const next = new URLSearchParams(searchParams.toString());
            next.delete("thread");
            router.replace(`?${next.toString()}`, { scroll: false });
          }
          return;
        }
        const payload = (await res.json()) as {
          thread?: { messagesJson?: unknown[]; title?: string | null };
        };
        if (cancelled) return;
        const json = payload.thread?.messagesJson ?? [];

        // DEFENSE: never overwrite live local messages with an empty server
        // payload. This prevents the auto-create race from wiping the
        // freshly-streamed first response.
        if (json.length === 0 && agent.messages.length > 0) {
          hydratedRef.current = threadId;
          setHydratedThreadId(threadId);
          setTitleGenerated(Boolean(payload.thread?.title));
          return;
        }

        const restored = toAgentMessages(json);
        hydratedRef.current = threadId;
        lastSavedHashRef.current = JSON.stringify(restored);
        agent.setMessages(restored as typeof agent.messages);
        setHydratedThreadId(threadId);
        setTitleGenerated(Boolean(payload.thread?.title));
      } catch {
        // ignore — thread missing, network error, etc.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, runtimeReady, agent]);

  // Auto-create thread on first user message and push to URL. Mark as
  // hydrated BEFORE the URL update so the hydration effect's next firing
  // sees a matching ref and bails out.
  useEffect(() => {
    if (threadId) return;
    if (messages.length === 0) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/threads", { method: "POST" });
        if (!res.ok) return;
        const payload = (await res.json()) as { thread?: { id?: string } };
        const newId = payload.thread?.id;
        if (cancelled || !newId) return;

        // Mark hydrated synchronously BEFORE pushing the URL so the
        // hydration effect bails out when threadId changes.
        hydratedRef.current = newId;
        setHydratedThreadId(newId);
        setTitleGenerated(false);

        const next = new URLSearchParams(searchParams.toString());
        next.set("thread", newId);
        router.replace(`?${next.toString()}`, { scroll: false });
      } catch {
        // ignore
      } finally {
        creatingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, threadId]);

  // Debounced save on message change. Don't save mid-stream: the agent
  // mutates the assistant message in place on every token.
  const isRunning = Boolean(agent?.isRunning);
  const serialized = JSON.stringify(messages);
  useEffect(() => {
    if (!threadId || hydratedThreadId !== threadId) return;
    if (messages.length === 0 || isRunning) return;
    if (serialized === lastSavedHashRef.current) return;

    const snapshot = JSON.parse(serialized) as AgentMessage[];
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const firstUserMessage = findFirstUserText(snapshot);
      try {
        const res = await fetch(`/api/threads/${threadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: snapshot,
            generateTitle: !titleGenerated,
            firstUserMessage,
          }),
        });
        if (res.ok) {
          lastSavedHashRef.current = serialized;
          if (!titleGenerated) {
            const payload = (await res.json()) as { title?: string };
            if (payload.title) {
              setTitleGenerated(true);
              window.dispatchEvent(
                new CustomEvent("yc-thread-title", {
                  detail: { id: threadId, title: payload.title },
                }),
              );
            }
          }
        }
      } catch {
        // best-effort
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, isRunning, threadId, hydratedThreadId, titleGenerated]);

  return null;
}

/**
 * Threads saved before the CopilotKit 1.56 upgrade hold the GraphQL message
 * JSON (`{ type: "TextMessage", ... }`); newer ones hold AG-UI messages
 * (`{ role, content, ... }`, no `type`) straight from the agent.
 */
function toAgentMessages(json: unknown[]): unknown[] {
  const isLegacy =
    json.length > 0 &&
    json.every((m) => m && typeof m === "object" && typeof (m as { type?: unknown }).type === "string");
  if (!isLegacy) return json;
  try {
    return gqlToAGUI(loadMessagesFromJsonRepresentation(json));
  } catch {
    return [];
  }
}

function findFirstUserText(messages: AgentMessage[]): string | undefined {
  for (const m of messages) {
    if (m?.role !== "user") continue;
    if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
    if (Array.isArray(m.content)) {
      const text = m.content
        .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return undefined;
}
