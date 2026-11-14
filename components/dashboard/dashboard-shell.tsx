"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Compass, MessageSquare, PanelRightClose, PanelRightOpen, Rows3 } from "lucide-react";
import { CopilotChat } from "@copilotkit/react-ui";

import { cn } from "../../lib/utils";
import { ChatPersistence } from "./chat-persistence";
import { ChatWelcome } from "./chat-welcome";
import { ExplorePanel, useOverview } from "./explore-panel";
import { PendingQuestionReplay } from "./pending-question-replay";
import { ChatToolbar } from "./thread-sidebar";
import { useWorkspace, WorkspaceProvider } from "./workspace-context";

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

The screen has three parts: an explore panel on the left (stats, batches, industries, tags), this
chat in the middle, and a companies drawer on the right that slides open to show results.
You can drive the companies drawer via tools (they open it automatically):
- searchCompanies: update the companies drawer by applying a query and/or filters. It also renders compact
  company cards for the top matching companies; when those cards appear, do not duplicate them
  as a manual bulleted list.
- clearFilters: reset the dashboard.
- switchView: change the drawer view.
  - 'graph' → opens the 3D force graph, a spatial network showing semantic similarity between
    companies. USE THIS whenever the user says "show me a graph", "visualize", "map out",
    "see connections", "cluster", "network", or anything implying a spatial/relational view.
    STRONGLY PREFER this over 'analytics' for any question about relationships or visual layout.
    Combine with searchCompanies first to scope the set of companies shown in the graph.
  - 'table' / 'cards' → results list (default views).
  - 'analytics' → batch bar chart. Use ONLY when the user explicitly asks for a chart or analytics.
- openCompanyDetail: opens a company detail overlay — does NOT navigate away.
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
- If your answer contains a short list of companies, use a company-returning tool first so the list
  appears as cards. Do not answer from the visibleCompanies readable with only markdown bullets.
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
  title: "yc search",
  initial: "",
  placeholder: "Ask about YC companies or founders…",
};

const DRAWER_WIDTH_KEY = "yc-drawer-width";
const DRAWER_WIDTH_DEFAULT = 720;
const DRAWER_WIDTH_MIN = 420;
const DRAWER_WIDTH_MAX = 1200;

type MobileTab = "explore" | "chat" | "results";

/** True when the URL already carries a search/filter, so results should be visible on load. */
function urlHasResultsState() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return ["q", "tags", "industries", "batches", "regions", "stages", "years", "sources", "isHiring", "graph", "company"].some(
    (key) => Boolean(params.get(key)),
  ) || ["analytics", "vendors"].includes(params.get("tab") ?? "");
}

function useIsLg() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia("(min-width: 1024px)");
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

function useLockDocumentScroll() {
  useEffect(() => {
    const html = document.documentElement.style.overflow;
    const body = document.body.style.overflow;
    const height = document.body.style.height;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100dvh";
    return () => {
      document.documentElement.style.overflow = html;
      document.body.style.overflow = body;
      document.body.style.height = height;
    };
  }, []);
}

export function DashboardShell({
  children,
  copilotEnabled,
}: {
  children: React.ReactNode;
  copilotEnabled: boolean;
}) {
  // Without chat, results are the main surface, so start with them open.
  const [initialOpen] = useState(() => !copilotEnabled || urlHasResultsState());
  return (
    <WorkspaceProvider initialDrawerOpen={initialOpen}>
      <Workspace copilotEnabled={copilotEnabled}>{children}</Workspace>
    </WorkspaceProvider>
  );
}

function Workspace({ children, copilotEnabled }: { children: React.ReactNode; copilotEnabled: boolean }) {
  useLockDocumentScroll();
  const workspace = useWorkspace();
  const drawerOpen = workspace?.drawerOpen ?? false;
  const isLg = useIsLg();
  const { overview } = useOverview();
  const [instructions] = useState(() => buildInstructions(new Date().toISOString().split("T")[0]));

  const [mobileTab, setMobileTab] = useState<MobileTab>(copilotEnabled ? "chat" : "results");
  // Anything that opens the drawer (explore panel, chat tools) should surface results on mobile.
  const [prevDrawerOpen, setPrevDrawerOpen] = useState(drawerOpen);
  if (drawerOpen !== prevDrawerOpen) {
    setPrevDrawerOpen(drawerOpen);
    if (drawerOpen) setMobileTab("results");
  }

  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DRAWER_WIDTH_DEFAULT;
    try {
      const saved = parseInt(window.localStorage.getItem(DRAWER_WIDTH_KEY) ?? "", 10);
      if (Number.isFinite(saved)) return Math.min(Math.max(saved, DRAWER_WIDTH_MIN), DRAWER_WIDTH_MAX);
    } catch {
      // storage unavailable
    }
    return DRAWER_WIDTH_DEFAULT;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(DRAWER_WIDTH_KEY, String(drawerWidth));
    } catch {
      // storage unavailable
    }
  }, [drawerWidth]);

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: drawerWidth };
      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const next = dragRef.current.startWidth + (dragRef.current.startX - ev.clientX);
        const max = Math.min(DRAWER_WIDTH_MAX, window.innerWidth - 560);
        setDrawerWidth(Math.min(Math.max(next, DRAWER_WIDTH_MIN), Math.max(DRAWER_WIDTH_MIN, max)));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [drawerWidth],
  );

  const showExplore = isLg || mobileTab === "explore";
  const showChat = copilotEnabled && (isLg || mobileTab === "chat");
  // Desktop without chat: results take the whole center. Mobile: only on its tab.
  const showResults = isLg ? drawerOpen || !copilotEnabled : mobileTab === "results";

  const drawerToggle = copilotEnabled ? (
    <button
      type="button"
      onClick={() => workspace?.toggleDrawer()}
      className={cn(
        "hidden h-7 items-center gap-1.5 rounded-md px-2 text-xs transition lg:inline-flex",
        drawerOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-pressed={drawerOpen}
    >
      {drawerOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
      {drawerOpen ? "Hide companies" : "Browse companies"}
    </button>
  ) : null;

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1">
        {showExplore ? (
          <aside
            aria-label="Explore the data"
            className="min-h-0 w-full shrink-0 overflow-y-auto overscroll-contain border-r border-border bg-card lg:w-[300px] xl:w-[320px]"
          >
            <ExplorePanel overview={overview} />
          </aside>
        ) : null}

        {copilotEnabled ? (
          <>
            <Suspense fallback={null}>
              <ChatPersistence />
            </Suspense>
            <PendingQuestionReplay />
          </>
        ) : null}

        {copilotEnabled ? (
          <section
            aria-label="Chat"
            className={cn("min-h-0 min-w-0 flex-1 flex-col", showChat ? "flex" : "hidden")}
          >
            <Suspense fallback={null}>
              <ChatToolbar trailing={drawerToggle} />
            </Suspense>
            <ChatSurface overview={overview} instructions={instructions} />
          </section>
        ) : null}

        {/* Results stay mounted while hidden: SearchDashboard hosts the chat tools. */}
        <section
          aria-label="Companies"
          data-browse-pane
          className={cn(
            "relative min-h-0 min-w-0 flex-col bg-background",
            showResults ? "flex" : "hidden",
            copilotEnabled && isLg ? "shrink-0 border-l border-border" : "flex-1",
          )}
          style={copilotEnabled && isLg ? { width: drawerWidth } : undefined}
        >
          {copilotEnabled && isLg ? (
            <div
              onPointerDown={onDragStart}
              className="absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize transition-colors hover:bg-primary/20"
              title="Drag to resize"
              aria-hidden="true"
            />
          ) : null}
          {copilotEnabled && isLg ? (
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-medium">Companies</span>
              <button
                type="button"
                onClick={() => workspace?.closeDrawer()}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close companies"
              >
                <PanelRightClose className="size-4" />
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        </section>
      </div>

      <nav className="shrink-0 border-t border-border bg-background lg:hidden" aria-label="Sections">
        <div className="flex">
          <MobileTabButton active={mobileTab === "explore"} onClick={() => setMobileTab("explore")} icon={<Compass className="size-5" />}>
            Explore
          </MobileTabButton>
          {copilotEnabled ? (
            <MobileTabButton active={mobileTab === "chat"} onClick={() => setMobileTab("chat")} icon={<MessageSquare className="size-5" />}>
              Ask
            </MobileTabButton>
          ) : null}
          <MobileTabButton active={mobileTab === "results"} onClick={() => setMobileTab("results")} icon={<Rows3 className="size-5" />}>
            Companies
          </MobileTabButton>
        </div>
      </nav>
    </div>
  );
}

/**
 * True once the chat shows any message. Watches the rendered list because
 * `useCopilotMessagesContext().messages` stays empty in CopilotKit 1.56.
 */
function useChatHasMessages(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [hasMessages, setHasMessages] = useState(false);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const check = () => setHasMessages(node.querySelector(".copilotKitMessage") !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef]);
  return hasMessages;
}

function ChatSurface({ overview, instructions }: { overview: ReturnType<typeof useOverview>["overview"]; instructions: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const empty = !useChatHasMessages(containerRef);

  return (
    <div ref={containerRef} className={cn("relative flex min-h-0 flex-1 flex-col", empty && "chat-empty")}>
      {empty ? (
        <div className="absolute inset-x-0 top-0 bottom-[112px] z-40 sm:bottom-[96px] overflow-y-auto bg-background">
          <ChatWelcome overview={overview} />
        </div>
      ) : null}
      <CopilotChat
        instructions={instructions}
        labels={CHAT_LABELS}
        className="chat-centered flex min-h-0 flex-1 flex-col overflow-hidden"
      />
    </div>
  );
}

function MobileTabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
