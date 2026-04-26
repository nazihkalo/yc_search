"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsRight, History, Plus, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "../../lib/utils";

type Thread = {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
};

export function ChatToolbar({ onCollapse }: { onCollapse?: () => void } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("thread");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) {
        setThreads([]);
        return;
      }
      const payload = (await res.json()) as { threads: Thread[] };
      setThreads(payload.threads ?? []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (historyOpen) void refresh();
  }, [historyOpen, refresh]);

  useEffect(() => {
    function onTitle(event: Event) {
      const detail = (event as CustomEvent).detail as { id: string; title: string } | undefined;
      if (!detail) return;
      setThreads((current) => {
        const exists = current.some((t) => t.id === detail.id);
        if (!exists) {
          void refresh();
          return current;
        }
        return current.map((t) =>
          t.id === detail.id ? { ...t, title: detail.title, updatedAt: new Date().toISOString() } : t,
        );
      });
    }
    window.addEventListener("yc-thread-title", onTitle);
    return () => window.removeEventListener("yc-thread-title", onTitle);
  }, [refresh]);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!historyOpen) return;
    function onClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setHistoryOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHistoryOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [historyOpen]);

  function go(id: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (id) {
      next.set("thread", id);
    } else {
      next.delete("thread");
    }
    router.push(`?${next.toString()}`, { scroll: false });
    setHistoryOpen(false);
  }

  function newThread() {
    go(null);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  async function remove(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await fetch(`/api/threads/${id}`, { method: "DELETE" });
      setThreads((current) => current.filter((t) => t.id !== id));
      if (activeId === id) {
        go(null);
      }
    } catch {
      // ignore
    }
  }

  const activeThread = threads.find((t) => t.id === activeId);

  return (
    <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          title="Chat history"
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary",
            historyOpen && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          <History className="size-3.5" />
        </button>
        <span className="truncate text-xs text-muted-foreground">
          {activeThread?.title ?? (activeId ? "Untitled" : "New conversation")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => newThread()}
          title="New chat"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-foreground/80 transition hover:border-primary/40 hover:text-primary"
        >
          <Plus className="size-3" />
          New
        </button>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse chat"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        ) : null}
      </div>

      {historyOpen ? (
        <div
          ref={popoverRef}
          className="absolute left-2 right-2 top-[calc(100%+4px)] z-30 max-h-[60vh] overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Chat history
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
            ) : threads.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No conversations yet.</div>
            ) : (
              <ul className="space-y-1">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => go(thread.id)}
                      className={cn(
                        "group flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition",
                        activeId === thread.id
                          ? "border-primary/30 bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:border-border/60 hover:bg-card/60 hover:text-foreground",
                      )}
                    >
                      <span className="line-clamp-2 break-words text-xs leading-snug">
                        {thread.title ?? "New conversation"}
                      </span>
                      <span
                        onClick={(event) => void remove(thread.id, event)}
                        className="invisible rounded p-1 text-muted-foreground transition hover:text-destructive group-hover:visible"
                        title="Delete"
                        role="button"
                      >
                        <Trash2 className="size-3" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
