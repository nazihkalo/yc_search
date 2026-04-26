"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Rows3 } from "lucide-react";
import { CopilotChat } from "@copilotkit/react-ui";

import { cn } from "../../lib/utils";
import { ChatPersistence } from "./chat-persistence";
import { PendingQuestionReplay } from "./pending-question-replay";
import { ChatToolbar } from "./thread-sidebar";

function buildInstructions(today: string): string {
  return `You are an analyst helping someone research the YC startup space.
Your job: help them figure out who's already building in their space, who tried something similar
and pivoted, and what the YC playbook for a category looks like.

Today's date is ${today}. YC batches are named like "Winter 2024" / "W24", "Summer 2024" / "S24",
"Spring 2026", "Fall 2026". When the user says "recent" / "latest" / "last year" / "this year",
DO NOT pick a single batch as a filter — the data is sliced into discrete batches and combining a
batch filter with a topic almost always returns zero matches. Instead:
- For askKnowledgeBase / findFounders: just pass the topic as \`query\` with NO batch filter.
- For searchCompanies: pass \`sort: "newest"\` and the topic as \`query\`. Skip the \`batches\` field
  unless the user names an explicit batch ("S24", "Winter 2025", etc).

You can drive the user's left-side dashboard via tools:
- searchCompanies: update the table by applying a query and/or filters.
- clearFilters: reset the dashboard.
- switchView: change the left-pane view.
  - 'graph' → opens the 3D force graph, a spatial network showing semantic similarity between
    companies. USE THIS whenever the user says "show me a graph", "visualize", "map out",
    "see connections", "cluster", "network", or anything implying a spatial/relational view.
    STRONGLY PREFER this over 'analytics' for any question about relationships or visual layout.
    Combine with searchCompanies first to scope the set of companies shown in the graph.
  - 'table' / 'cards' → results list (default views).
  - 'analytics' → batch bar chart. Use ONLY when the user explicitly asks for a chart or analytics.
- openCompanyDetail: opens a company in the LEFT pane next to the chat — does NOT navigate away.
  Use it freely to show company details without leaving the dashboard.
- askKnowledgeBase: retrieve a few of the most relevant companies for a factual question about the
  YC space. The chat UI renders rich inline COMPANY cards for the results.
- lookupCompany: fetch full details about ONE specific company. The chat UI renders a detail card.
- findFounders: when the user is asking about FOUNDERS / PEOPLE (e.g. "who are the founders of
  robotics startups", "show me YC founders building in healthcare"). The chat UI renders dedicated
  FOUNDER PROFILE cards (avatar, bio, LinkedIn, GitHub, plus a tag for their company). Use this
  instead of askKnowledgeBase when the question is about people.

CRITICAL — avoid redundancy with the inline cards:
- The cards already show: logos, names, batches, industries, one-liners, founder names + photos +
  socials, and links. NEVER repeat that data in your prose, and NEVER paste images via markdown.
- Your prose job is just to add 1-3 sentences of *insight*: the pattern, what's surprising, what to
  look at next. Do NOT enumerate "Here are the founders: 1. Alice from X. 2. Bob from Y." — the
  cards already do that, and repeating it is annoying.
- A single-sentence intro ("Here are 5 founders in robotics — note that 3 are from Spring 2026.")
  followed by the cards is plenty.

If a tool returns zero results, retry once without filters (drop batches/industries) and lean on
the query string only. Only after a no-filter retry also returns zero should you tell the user
there's nothing in the index.

Style: plainspoken, concise. Never invent companies or founders — if you're not sure, say so.`;
}

const CHAT_LABELS = {
  title: "yc·search assistant",
  initial: "Ask me about YC companies — by idea, batch, industry, or founder.",
  placeholder: "What kind of YC company are you looking for?",
};

const COLLAPSED_KEY = "yc-chat-collapsed";
const CHAT_WIDTH_KEY = "yc-chat-width";
const CHAT_WIDTH_DEFAULT = 440;
const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 760;

type MobileTab = "chat" | "browse";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const instructions = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return buildInstructions(today);
  }, []);

  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const [chatWidth, setChatWidth] = useState<number>(() => {
    if (typeof window === "undefined") return CHAT_WIDTH_DEFAULT;
    const saved = parseInt(window.localStorage.getItem(CHAT_WIDTH_KEY) ?? "", 10);
    return Number.isFinite(saved)
      ? Math.min(Math.max(saved, CHAT_WIDTH_MIN), CHAT_WIDTH_MAX)
      : CHAT_WIDTH_DEFAULT;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth));
  }, [chatWidth]);

  // Used to gate desktop-only behaviours (collapse button, fixed chat width).
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsLg(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = chatWidth;

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = startXRef.current - ev.clientX;
        const next = Math.min(
          Math.max(startWidthRef.current + delta, CHAT_WIDTH_MIN),
          CHAT_WIDTH_MAX,
        );
        setChatWidth(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [chatWidth],
  );

  // On mobile, always show full chat regardless of collapsed state.
  const showCollapsedBar = collapsed && isLg;

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full flex-col overflow-hidden lg:flex-row">

      {/* ── Browse pane ─────────────────────────────────────────── */}
      <div
        data-browse-pane
        className={cn(
          "overflow-y-auto lg:flex-1",
          mobileTab === "browse" ? "flex-1" : "hidden lg:block",
        )}
      >
        {children}
      </div>

      {/* Chat state always mounted so saves/thread keep working. */}
      <Suspense fallback={null}>
        <ChatPersistence />
      </Suspense>
      <PendingQuestionReplay />

      {/* ── Chat pane ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "bg-card/30",
          // Mobile: fill height when chat tab; hidden when browse tab.
          mobileTab === "chat" ? "flex flex-1 flex-col" : "hidden",
          // Desktop: always visible as a side panel in row direction.
          "lg:flex lg:flex-none lg:shrink-0 lg:flex-row",
        )}
      >
        {showCollapsedBar ? (
          // Collapsed bar — desktop only (mobile never reaches here).
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand chat"
            className="flex w-10 flex-col items-center gap-2 border-l border-border/40 px-1 py-3 text-xs text-muted-foreground transition hover:text-primary"
          >
            <MessageSquare className="size-4" />
            <span
              className="select-none whitespace-nowrap text-[10px] uppercase tracking-[0.2em]"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Open chat
            </span>
          </button>
        ) : (
          <>
            {/* Drag handle — desktop only */}
            <div
              onMouseDown={onDragStart}
              className="group hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center border-l border-border/40 transition-colors hover:border-primary/60 hover:bg-primary/10 active:bg-primary/20 lg:flex"
              title="Drag to resize"
            >
              <div className="h-8 w-px rounded-full bg-border/60 transition-colors group-hover:bg-primary/50" />
            </div>

            {/* Chat content */}
            <div
              className="flex h-full min-h-0 w-full flex-col border-l border-border/40 lg:border-l-0"
              style={isLg ? { width: chatWidth } : undefined}
            >
              <Suspense fallback={null}>
                <ChatToolbar onCollapse={isLg ? () => setCollapsed(true) : undefined} />
              </Suspense>
              <CopilotChat
                instructions={instructions}
                labels={CHAT_LABELS}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              />
            </div>
          </>
        )}
      </aside>

      {/* ── Mobile bottom tab bar ───────────────────────────────── */}
      <nav className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur lg:hidden">
        <div className="flex">
          <button
            type="button"
            onClick={() => setMobileTab("browse")}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition",
              mobileTab === "browse" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Rows3 className="size-5" />
            Browse
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition",
              mobileTab === "chat" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="size-5" />
            Chat
          </button>
        </div>
      </nav>
    </div>
  );
}
