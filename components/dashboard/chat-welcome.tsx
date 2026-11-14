"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import { sendToChat } from "../../lib/chat-input";
import type { Overview } from "../../lib/overview";

type Starter = { kicker: string; prompt: string };

function buildStarters(overview: Overview | null): Starter[] {
  const latest = overview?.recentBatchNames[0] ?? "the latest batch";
  const rising = overview?.trendingTags[0]?.name ?? "AI agents";
  const risingSecond = overview?.trendingTags[1]?.name ?? "developer tools";

  return [
    {
      kicker: "Survey a batch",
      prompt: `What is ${latest} building? Group the companies into the main themes.`,
    },
    {
      kicker: "Map a market",
      prompt: `Who's building in ${rising}? Show me the most interesting companies and how they differ.`,
    },
    {
      kicker: "Find people",
      prompt: `Find founders working on ${risingSecond} who have strong GitHub profiles.`,
    },
    {
      kicker: "Check an idea",
      prompt: "I want to build an AI bookkeeper for small businesses. Who has tried this, and what happened?",
    },
  ];
}

export function ChatWelcome({ overview }: { overview: Overview | null }) {
  const starters = useMemo(() => buildStarters(overview), [overview]);

  const send = (prompt: string) => {
    void sendToChat(prompt);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pb-6 pt-10 sm:pt-16">
      <h1 className="font-display text-[38px] leading-[1.05] tracking-[-0.01em] text-foreground sm:text-5xl">
        What do you want to know about YC startups?
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
        {overview && overview.companies > 0 ? (
          <>
            Ask about any of{" "}
            <span className="font-medium text-foreground">{overview.companies.toLocaleString("en-US")}</span> companies
            {overview.founders > 0 ? (
              <>
                {" "}and <span className="font-medium text-foreground">{overview.founders.toLocaleString("en-US")}</span>{" "}
                founders
              </>
            ) : null}{" "}
            across {overview.batchCount} batches. Answers come back as company and founder cards you can open.
          </>
        ) : (
          <>Ask about any YC company, founder, batch, or market. Answers come back as cards you can open.</>
        )}{" "}
        <span className="hidden lg:inline">Or pick a batch, industry, or tag on the left to browse.</span>
      </p>

      <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        {starters.map((starter) => (
          <li key={starter.kicker} className="bg-background">
            <button
              type="button"
              onClick={() => send(starter.prompt)}
              className="group flex h-full w-full flex-col gap-1.5 px-4 py-3.5 text-left transition hover:bg-muted"
            >
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                {starter.kicker}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                />
              </span>
              <span className="text-sm leading-6 text-foreground">{starter.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
