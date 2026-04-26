"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCopilotMessagesContext } from "@copilotkit/react-core";
import { loadMessagesFromJsonRepresentation } from "@copilotkit/runtime-client-gql";

const SAVE_DEBOUNCE_MS = 800;

export function ChatPersistence() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadId = searchParams.get("thread");
  const { messages, setMessages } = useCopilotMessagesContext();

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
        if (json.length === 0 && messages.length > 0) {
          hydratedRef.current = threadId;
          setHydratedThreadId(threadId);
          setTitleGenerated(Boolean(payload.thread?.title));
          return;
        }

        const restored = loadMessagesFromJsonRepresentation(json as unknown[]);
        hydratedRef.current = threadId;
        setMessages(restored);
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
  }, [threadId]);

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

  // Debounced save on message change.
  useEffect(() => {
    if (!threadId || hydratedThreadId !== threadId) return;
    if (messages.length === 0) return;

    const serialized = JSON.stringify(messages);
    if (serialized === lastSavedHashRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const firstUserMessage = findFirstUserText(messages);
      try {
        const res = await fetch(`/api/threads/${threadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
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
  }, [messages, threadId, hydratedThreadId, titleGenerated]);

  return null;
}

function findFirstUserText(messages: unknown[]): string | undefined {
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as { role?: string; content?: unknown };
    if (m.role !== "user") continue;
    if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
  }
  return undefined;
}
