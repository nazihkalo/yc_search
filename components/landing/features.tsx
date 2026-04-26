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
    title: "Search by idea, not just keywords",
    body:
      "Describe what you're thinking about in plain English. We surface every YC company working on something similar.",
  },
  {
    icon: Network,
    title: "See the neighborhood",
    body:
      "Pick a company and explore everyone building near it as an interactive 3D map. Great for spotting clusters and gaps.",
  },
  {
    icon: Bot,
    title: "Ask questions, get answers",
    body:
      "Talk to YC's collective output. Every answer cites the company pages it came from, so you can verify and click through.",
  },
  {
    icon: Github,
    title: "Know the founders",
    body:
      "Bios, links, top GitHub repos, and where they've been mentioned on the web — pulled in automatically.",
  },
  {
    icon: Filter,
    title: "Filter by anything",
    body:
      "Batch, stage, region, industry, hiring, nonprofit, top company — combine any of them with your search.",
  },
  {
    icon: BarChart3,
    title: "Track the batches",
    body:
      "See how many founders, what industries, what's trending. No spreadsheet needed.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
          Everything in one place
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
          Everything you need to research a startup idea.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Stop tab-juggling Crunchbase, LinkedIn, and Twitter. Companies, founders, and signal — in
          one place.
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
