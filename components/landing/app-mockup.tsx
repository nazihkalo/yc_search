import {
  ArrowRight,
  Bot,
  Building2,
  Database,
  Network,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

const COMPANIES = [
  {
    name: "Baseten",
    batch: "W20",
    fit: "AI infrastructure",
    signal: "Inference, model serving, enterprise AI",
  },
  {
    name: "Supabase",
    batch: "S20",
    fit: "Postgres platform",
    signal: "Database, auth, vector extensions",
  },
  {
    name: "Airbyte",
    batch: "W20",
    fit: "Data movement",
    signal: "ELT, connectors, warehouse sync",
  },
  {
    name: "Pave",
    batch: "W20",
    fit: "Company intelligence",
    signal: "Comp data, benchmarks, market datasets",
  },
];

const VENDORS = ["Postgres", "pgvector", "OpenAI", "Vercel", "AWS", "Stripe"];

function MiniNetwork() {
  const nodes = [
    { x: 46, y: 82, r: 5, className: "fill-primary" },
    { x: 96, y: 46, r: 4, className: "fill-chart-2" },
    { x: 152, y: 66, r: 7, className: "fill-primary" },
    { x: 204, y: 38, r: 4, className: "fill-chart-3" },
    { x: 238, y: 96, r: 5, className: "fill-chart-2" },
    { x: 166, y: 124, r: 4, className: "fill-chart-4" },
    { x: 92, y: 132, r: 6, className: "fill-chart-3" },
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [5, 6],
    [0, 6],
  ];

  return (
    <svg viewBox="0 0 280 160" className="h-full w-full" aria-hidden>
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          className="stroke-border"
          strokeWidth="1.4"
        />
      ))}
      {nodes.map((node, index) => (
        <circle
          key={index}
          cx={node.x}
          cy={node.y}
          r={node.r}
          className={node.className}
          opacity={index === 2 ? "0.95" : "0.72"}
        />
      ))}
    </svg>
  );
}

function BatchBars() {
  const bars = [42, 64, 38, 78, 92, 54, 88, 72];

  return (
    <div className="flex h-20 items-end gap-1.5" aria-hidden>
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-full rounded-sm bg-primary/25"
          style={{ height: `${height}%` }}
        >
          <div className="h-1/2 rounded-sm bg-primary/65" />
        </div>
      ))}
    </div>
  );
}

function MobilePreview() {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-lg border border-border/60 bg-background/95 p-3 shadow-2xl shadow-background/40 md:hidden">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            yc·search
          </p>
          <p className="text-sm font-semibold text-foreground">Chat research</p>
        </div>
        <Bot className="size-5 text-primary" />
      </div>
      <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm leading-6 text-foreground">
        Find AI infra startups using Postgres or vector search.
      </div>
      <div className="mt-3 space-y-2">
        {COMPANIES.slice(0, 3).map((company) => (
          <div
            key={company.name}
            className="rounded-md border border-border/55 bg-card/70 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">{company.name}</p>
              <span className="rounded-md border border-border/55 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {company.batch}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{company.signal}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Continue in YC Search
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

export function AppMockup() {
  return (
    <section id="preview" className="relative mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
      <MobilePreview />

      <div className="hidden overflow-hidden rounded-lg border border-border/55 bg-card/65 shadow-2xl shadow-background/45 md:block">
        <div className="flex items-center justify-between gap-4 border-b border-border/45 bg-background/65 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/12 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                yc·search command center
              </p>
              <p className="text-xs text-muted-foreground">
                Company intelligence from query to map
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border/55 px-2.5 py-1">Table</span>
            <span className="rounded-md border border-border/55 px-2.5 py-1">Graph</span>
            <span className="rounded-md border border-border/55 px-2.5 py-1">Founders</span>
          </div>
        </div>

        <div className="grid min-h-[620px] grid-cols-[300px_minmax(0,1fr)_270px] gap-px bg-border/45 lg:grid-cols-[340px_minmax(0,1fr)_300px]">
          <aside className="flex min-h-0 flex-col bg-background/72">
            <div className="border-b border-border/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ask YC Search
              </p>
              <div className="mt-3 rounded-lg border border-primary/25 bg-primary/10 p-3">
                <p className="text-sm leading-6 text-foreground">
                  Find AI infrastructure startups using Postgres or vector search.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-full border border-border/55 bg-card/70 px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <span className="flex-1 text-xs text-muted-foreground">Refine by vendor, founder, or batch</span>
                <Send className="size-4 text-primary" />
              </div>
            </div>

            <div className="flex-1 space-y-4 p-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Bot className="size-3.5 text-primary" />
                  Generated view
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/90">
                  I found a cluster around AI deployment, managed Postgres, data movement, and
                  developer infrastructure. Start with these companies, then inspect founders and
                  vendor signals.
                </p>
              </div>

              <div className="rounded-lg border border-border/55 bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Founder patterns</p>
                </div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p className="rounded-md bg-background/65 px-3 py-2">Prior infra operators</p>
                  <p className="rounded-md bg-background/65 px-3 py-2">Open-source maintainers</p>
                  <p className="rounded-md bg-background/65 px-3 py-2">Ex-cloud platform teams</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/55 bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Vendor signal</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VENDORS.map((vendor) => (
                    <span
                      key={vendor}
                      className="rounded-md border border-border/55 bg-background/70 px-2 py-1 text-xs text-muted-foreground"
                    >
                      {vendor}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 bg-background/82">
            <div className="border-b border-border/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Generated company set
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                    AI infrastructure near Postgres
                  </h2>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Start this search
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-border/45 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Fit</th>
                    <th className="px-4 py-3 font-medium">Signal</th>
                    <th className="px-4 py-3 font-medium">Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/35">
                  {COMPANIES.map((company) => (
                    <tr key={company.name} className="transition hover:bg-card/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/55 bg-card/70">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <p className="font-semibold text-foreground">{company.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{company.fit}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <span className="line-clamp-2 max-w-xs">{company.signal}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-md border border-border/55 bg-card/70 px-2 py-1 text-xs text-foreground/80">
                          {company.batch}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-px bg-border/45 lg:grid-cols-2">
              <div className="bg-card/45 p-4">
                <div className="flex items-center gap-2">
                  <Network className="size-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Category neighborhood</p>
                </div>
                <div className="mt-3 h-36 rounded-md border border-border/45 bg-background/55 p-2">
                  <MiniNetwork />
                </div>
              </div>
              <div className="bg-card/45 p-4">
                <p className="text-sm font-semibold text-foreground">Batch momentum</p>
                <p className="mt-1 text-xs text-muted-foreground">More infra startups appear in recent batches.</p>
                <div className="mt-4 rounded-md border border-border/45 bg-background/55 p-3">
                  <BatchBars />
                </div>
              </div>
            </div>
          </main>

          <aside className="bg-background/72 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Company detail
            </p>
            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-4">
              <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">Supabase</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Open-source Firebase alternative built on Postgres, with clear overlap across
                developer tools, database infrastructure, and vector search workflows.
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Founders", "OSS and developer tooling background"],
                ["Vendors", "Postgres, Stripe, Vercel signals"],
                ["Adjacency", "Database, auth, embeddings"],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-border/45 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
