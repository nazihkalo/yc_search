import Link from "next/link";
import { ArrowRight, Check, Clock3 } from "lucide-react";

import { Button } from "../ui/button";

const INCLUDED = [
  "Search every YC company and batch",
  "Ask questions with cited company cards",
  "Open founder and vendor intelligence",
  "Use table, graph, and analytics views",
  "Save your question through signup",
];

const LATER = ["Saved searches", "Team alerts", "CSV exports", "API access"];

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded-lg border border-border/55 bg-card/55 p-6 sm:p-8 lg:grid-cols-[1fr_420px] lg:p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
            Beta access
          </p>
          <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Start with the full product while it is free.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Create an account and use the search, chat, graph, company profiles, founders, vendors,
            and analytics together. No credit card required.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/sign-up">
                Start exploring free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/55 bg-background/65 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Included now</p>
              <p className="text-xs text-muted-foreground">Full beta access</p>
            </div>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Free
            </span>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-foreground/90">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-border/45 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="size-4 text-primary" />
              Pro later
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {LATER.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-border/55 bg-card/70 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
