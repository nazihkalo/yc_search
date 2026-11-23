"use client";

import { captureEvent } from "../../lib/analytics/client";
import { questionMetadata } from "../../lib/analytics/events";
import Link from "next/link";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { useCallback, useState } from "react";

const DEFAULT_SUGGESTIONS = [
  "Has anyone built an AI tutor for K-12?",
  "Who's building software for plumbers and HVAC?",
  "Climate tech companies from the last two years",
];

const STORAGE_KEY = "yc_pending_question";

type Citation = {
  id: number;
  name: string;
  slug: string | null;
  batch: string | null;
  industry: string | null;
  oneLiner: string | null;
  ycProfileUrl: string | null;
  websiteUrl: string | null;
};

type Phase = "idle" | "streaming" | "done" | "rate_limited" | "error";

export function LandingChatPrompt({ suggestions = DEFAULT_SUGGESTIONS }: { suggestions?: string[] }) {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || phase === "streaming") return;

    // Carry the question through sign-up so the dashboard can answer it in full.
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // storage unavailable
    }

    const started = Date.now();
    captureEvent("preview_question_submitted", questionMetadata(trimmed));
    setPhase("streaming");
    setAnswer("");
    setCitations([]);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/landing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (response.status === 429) {
        // Preserve the question for the sign-up flow.
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, trimmed);
        }
        captureEvent("preview_rate_limited");
        setPhase("rate_limited");
        return;
      }

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setErrorMessage(payload?.message ?? "Could not run that question.");
        captureEvent("preview_answer_failed", { reason: "http" });
        setPhase("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const lines = block.split("\n");
          let eventName = "message";
          let dataPayload = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataPayload += line.slice(6);
          }
          if (!dataPayload) continue;
          try {
            const parsed = JSON.parse(dataPayload);
            if (eventName === "done") completed = true;
            if (eventName === "citations" && Array.isArray(parsed)) {
              setCitations(parsed as Citation[]);
            } else if (eventName === "delta" && typeof parsed === "string") {
              setAnswer((prev) => prev + parsed);
            } else if (eventName === "error" && parsed?.message) {
              setErrorMessage(String(parsed.message));
              captureEvent("preview_answer_failed", { reason: "stream" });
              setPhase("error");
              return;
            }
          } catch {
            // ignore malformed payloads
          }
        }
      }

      if (!completed) throw new Error("The response ended before completion. Please try again.");
      captureEvent("preview_answer_completed", { duration_ms: Date.now() - started });
      setPhase("done");
    } catch (error) {
      captureEvent("preview_answer_failed", { reason: "network" });
      const message = error instanceof Error ? error.message : "Network error";
      setErrorMessage(message);
      setPhase("error");
    }
  }, [phase]);

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit(question);
    },
    [question, submit],
  );

  const signUpHref = `/sign-up${
    question.trim() ? `?q=${encodeURIComponent(question.trim())}` : ""
  }`;

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className="relative">
        <label htmlFor="landing-question" className="sr-only">
          Ask a question about YC companies
        </label>
        <textarea
          id="landing-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(question);
            }
          }}
          rows={2}
          maxLength={500}
          disabled={phase === "streaming"}
          placeholder="Has anyone in YC built an AI bookkeeper for restaurants?"
          className="block w-full resize-none rounded-lg border border-foreground/20 bg-background px-4 py-3.5 pr-14 text-base leading-relaxed text-foreground shadow-[0_1px_0_0_var(--border)] placeholder:text-muted-foreground focus:border-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={phase === "streaming" || !question.trim()}
          className="absolute bottom-3 right-3 inline-flex size-9 items-center justify-center rounded-md bg-foreground text-background transition hover:bg-primary disabled:opacity-30"
          aria-label="Ask"
        >
          {phase === "streaming" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>

      {phase === "idle" ? (
        <div className="mt-3 flex flex-col items-start gap-1.5 text-sm">
          <span className="text-xs text-muted-foreground">Try one, no account needed:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                void submit(s);
              }}
              className="group inline-flex items-center gap-1.5 text-left text-foreground/80 underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-primary"
            >
              {s}
              <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {(phase === "streaming" || phase === "done") && (answer || citations.length > 0) ? (
        <div className="mt-6 space-y-5 text-left" aria-live="polite">
          {answer ? (
            <p className="whitespace-pre-wrap border-l-2 border-primary pl-4 text-[15px] leading-7 text-foreground">
              {answer}
            </p>
          ) : null}

          {citations.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {citations.map((citation) => (
                <li key={citation.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{citation.name}</span>
                    {citation.oneLiner ? (
                      <span className="text-muted-foreground"> — {citation.oneLiner}</span>
                    ) : null}
                  </div>
                  {citation.batch ? (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{citation.batch}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {phase === "done" ? (
            <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                Sign up to keep going. Your question carries over, with full company and founder cards.
              </p>
              <Link
                href={signUpHref}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-primary"
              >
                Continue free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "rate_limited" ? (
        <div className="mt-6 flex flex-col gap-3 rounded-lg bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            You&apos;ve used your free question. Sign up and we&apos;ll answer this one first.
          </p>
          <Link
            href={signUpHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-primary"
          >
            Continue free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      {phase === "error" && errorMessage ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
