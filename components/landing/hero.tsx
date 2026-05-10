import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, Sparkles } from "lucide-react";

const PROOF_POINTS = [
  "Search every YC batch",
  "Ask by idea, founder, vendor, or market",
  "Free beta access, no credit card",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto grid w-full max-w-[1280px] gap-8 px-4 pb-6 pt-14 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:px-8 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <Sparkles className="size-3.5" />
            Beta access is open
          </span>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-6xl">
            Explore the YC market from one prompt.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Find startups by idea, founder, vendor, batch, or adjacent market. YC Search turns a
            research question into companies, founders, charts, and category maps you can inspect.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sign-up"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start exploring free
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#preview"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              See the product
            </a>
          </div>

          <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {PROOF_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/55 p-3 shadow-2xl shadow-background/40">
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background/70 px-3 py-2">
            <Search className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              AI infra startups using Postgres
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/45 bg-background/55 p-3">
              <p className="text-muted-foreground">Matched companies</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">42</p>
            </div>
            <div className="rounded-md border border-border/45 bg-background/55 p-3">
              <p className="text-muted-foreground">Founder profiles</p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">118</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The preview below shows how chat, table, graph, founders, and vendor context fit
            together inside the app.
          </p>
        </div>
      </div>
    </section>
  );
}
