"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { useCallback, useState } from "react";

const SUGGESTIONS = [
  "AI agents for accountants",
  "Climate tech in S24",
  "Has anyone built an LLM tutor for K-12?",
  "B2B for plumbers and HVAC",
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

export function LandingChatPrompt() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || phase === "streaming") return;

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
        setPhase("rate_limited");
        return;
      }

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setErrorMessage(payload?.message ?? "Could not run that question.");
        setPhase("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            if (eventName === "citations" && Array.isArray(parsed)) {
              setCitations(parsed as Citation[]);
            } else if (eventName === "delta" && typeof parsed === "string") {
              setAnswer((prev) => prev + parsed);
            } else if (eventName === "error" && parsed?.message) {
              setErrorMessage(String(parsed.message));
              setPhase("error");
              return;
            }
          } catch {
            // ignore malformed payloads
          }
        }
      }

      setPhase("done");
    } catch (error) {
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
    <div className="mt-10 w-full max-w-2xl">
      <form onSubmit={onSubmit} className="relative">
        <textarea
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
          placeholder="Ask anything: 'Has anyone built X?' • 'Show me Spring 2026 fintech' • 'Climate tech founders with prior exits'"
          className="w-full resize-none rounded-3xl border border-border/60 bg-card/70 px-5 py-4 pr-14 text-left text-base leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={phase === "streaming" || !question.trim()}
          className="absolute bottom-3 right-3 inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          aria-label="Ask"
        >
          {phase === "streaming" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>

      {phase === "idle" ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                void submit(s);
              }}
              className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 transition hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {(phase === "streaming" || phase === "done") && (answer || citations.length > 0) ? (
        <div className="mt-6 space-y-4 text-left">
          {answer ? (
            <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Answer
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{answer}</p>
            </div>
          ) : null}

          {citations.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cited companies
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {citations.map((citation) => (
                  <div
                    key={citation.id}
                    className="rounded-2xl border border-border/60 bg-card/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-foreground">{citation.name}</div>
                      {citation.batch ? (
                        <span className="shrink-0 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground/70">
                          {citation.batch}
                        </span>
                      ) : null}
                    </div>
                    {citation.oneLiner ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {citation.oneLiner}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="rounded-3xl border border-primary/40 bg-primary/5 p-5 text-center">
              <p className="text-sm text-foreground/90">
                That&apos;s your free preview. Sign up to keep asking, drive the table and graph from
                chat, and see every citation.
              </p>
              <Link
                href={signUpHref}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Sign up free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "rate_limited" ? (
        <div className="mt-6 rounded-3xl border border-primary/40 bg-primary/5 p-5 text-center">
          <p className="text-sm text-foreground/90">
            You&apos;ve already used your free preview. Sign up to keep asking — your question is saved.
          </p>
          <Link
            href={signUpHref}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Sign up free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      {phase === "error" && errorMessage ? (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
