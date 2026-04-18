import {
  BarChart3,
  Bot,
  Filter,
  Github,
  Network,
  Search,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Hybrid search",
    body:
      "Keyword relevance fused with OpenAI embeddings across every YC batch, description, tag, and scraped website.",
  },
  {
    icon: Network,
    title: "3D similarity graph",
    body:
      "Explore the semantic neighborhood of any company as an interactive force-directed graph.",
  },
  {
    icon: Bot,
    title: "Ask-YC chat",
    body:
      "Natural-language Q&A grounded in the actual company pages we've crawled — with citations back to source.",
  },
  {
    icon: Github,
    title: "Founder enrichment",
    body:
      "Founder bios, LinkedIn/X/GitHub links, top public repos, languages, and web mentions — automatically.",
  },
  {
    icon: Filter,
    title: "Faceted filters",
    body:
      "Slice by batch, stage, region, industry, hiring, nonprofit, and top-company — combine any facet with search.",
  },
  {
    icon: BarChart3,
    title: "Batch analytics",
    body:
      "Founders-per-batch charts with optional category stacking by tag or industry — no spreadsheet required.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
          Everything in one place
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-ui-display)] text-4xl italic tracking-tight text-foreground sm:text-5xl">
          Built for founders, operators, and researchers.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Stop juggling Crunchbase tabs, LinkedIn stalking, and Twitter advanced search.
          Everything you need to understand who&apos;s in YC — and who they remind you of — in one surface.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="group relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 transition hover:-translate-y-[2px] hover:border-primary/40 hover:bg-card/70"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition group-hover:opacity-100"
            />
            <feature.icon className="size-6 text-primary" />
            <h3 className="mt-5 text-lg font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
