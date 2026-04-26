"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { CopilotChat } from "@copilotkit/react-ui";

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
- switchView / openCompanyDetail: navigate the UI. openCompanyDetail opens the company in the LEFT
  pane next to the chat — it does NOT navigate away. Use it freely.
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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const instructions = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return buildInstructions(today);
  }, []);

  // Initial value read in a lazy initializer; SSR returns false and the client
  // hydrates from localStorage on first paint.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full">
      <div className="flex-1 overflow-y-auto">{children}</div>
      {/* The chat persistence + actions still need to mount even when collapsed
          so background saves keep working without a tab reload. */}
      <ChatPersistence />
      <PendingQuestionReplay />
      {collapsed ? (
        <aside className="hidden shrink-0 border-l border-border/40 bg-card/30 lg:flex">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand chat"
            className="flex w-10 flex-col items-center gap-2 px-1 py-3 text-xs text-muted-foreground transition hover:text-primary"
          >
            <MessageSquare className="size-4" />
            <span
              className="select-none whitespace-nowrap text-[10px] uppercase tracking-[0.2em]"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Open chat
            </span>
          </button>
        </aside>
      ) : (
        <aside className="hidden shrink-0 border-l border-border/40 bg-card/30 lg:flex">
          <div className="flex w-[440px] flex-col">
            <ChatToolbar onCollapse={() => setCollapsed(true)} />
            <CopilotChat
              instructions={instructions}
              labels={CHAT_LABELS}
              className="flex flex-1 flex-col overflow-hidden"
            />
          </div>
        </aside>
      )}
    </div>
  );
}

