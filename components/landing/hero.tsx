import Link from "next/link";
import { Sparkles } from "lucide-react";

import { LandingChatPrompt } from "./chat-prompt";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 size-[540px] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3.5" />
          Free while in beta
        </span>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-7xl">
          Has it been done before?
          <span className="mt-2 block text-3xl font-medium tracking-[-0.03em] text-muted-foreground sm:text-5xl">
            Search every YC company in seconds.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Researching a startup idea? Find out who&apos;s already building in your space, who tried
          it and pivoted, and what the YC playbook for your category looks like — across 20 years
          of batches.
        </p>

        <LandingChatPrompt />

        <p className="mt-6 text-xs text-muted-foreground/80">
          One free question, no signup. <Link href="/sign-up" className="underline-offset-2 hover:text-foreground hover:underline">Sign up free</Link> to keep asking and drive the table from chat.
        </p>
      </div>
    </section>
  );
}
