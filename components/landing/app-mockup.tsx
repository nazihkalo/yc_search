import { MessageSquare, Network, Search } from "lucide-react";

const MOCK_COMPANIES = [
  { name: "Brex",      batch: "W17", industry: "Fintech",   oneliner: "Corporate cards & financial software for startups" },
  { name: "Ramp",      batch: "W19", industry: "Fintech",   oneliner: "Corporate cards + spend management that saves money" },
  { name: "Deel",      batch: "W19", industry: "HR Tech",   oneliner: "Global payroll and HR for distributed teams" },
  { name: "Gusto",     batch: "S11", industry: "HR Tech",   oneliner: "Payroll, benefits, and HR for small businesses" },
  { name: "Mercury",   batch: "S19", industry: "Banking",   oneliner: "Banking stack built for startups" },
  { name: "Pilot",     batch: "W17", industry: "Finance",   oneliner: "Bookkeeping and tax for growing startups" },
];

const BATCH_COLORS: Record<string, string> = {
  W17: "#ff6600",
  W19: "#e05c00",
  S11: "#ff8c38",
  S19: "#c44f00",
};

// Static SVG graph — positions chosen to look like a real force-directed layout
function MiniGraph() {
  const nodes = [
    { x: 72,  y: 52,  r: 7,  c: "#ff6600" },
    { x: 148, y: 34,  r: 5,  c: "#ff6600" },
    { x: 210, y: 64,  r: 9,  c: "#e05c00" },
    { x: 284, y: 42,  r: 5,  c: "#e05c00" },
    { x: 156, y: 108, r: 11, c: "#ff8c38" },
    { x: 236, y: 126, r: 6,  c: "#ff8c38" },
    { x: 308, y: 98,  r: 5,  c: "#ff6600" },
    { x: 96,  y: 130, r: 7,  c: "#c44f00" },
    { x: 360, y: 68,  r: 6,  c: "#e05c00" },
    { x: 332, y: 148, r: 5,  c: "#c44f00" },
    { x: 52,  y: 102, r: 4,  c: "#c44f00" },
    { x: 400, y: 108, r: 5,  c: "#ff8c38" },
    { x: 192, y: 162, r: 4,  c: "#c44f00" },
  ];
  const edges = [
    [0,1],[1,2],[2,3],[1,4],[4,5],[5,6],[4,7],[3,8],[8,11],[6,9],[0,10],[2,5],[5,12],[9,11],
  ];
  return (
    <svg viewBox="0 20 440 160" className="h-full w-full" aria-hidden>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.2"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r * 2.2} fill={n.c} opacity="0.12" />
          <circle cx={n.x} cy={n.y} r={n.r}       fill={n.c} opacity="0.88" />
        </g>
      ))}
    </svg>
  );
}

export function AppMockup() {
  return (
    <section className="relative mx-auto w-full max-w-[1280px] px-4 pb-4 pt-2 sm:px-6 lg:px-8">
      {/* Browser chrome */}
      <div className="overflow-hidden rounded-2xl border border-border/50 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3 border-b border-border/40 bg-muted/60 px-4 py-2.5 backdrop-blur">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-rose-400/70" />
            <span className="size-3 rounded-full bg-amber-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-md border border-border/40 bg-background/60 px-4 py-0.5 text-[11px] text-muted-foreground/60">
              ycsearch.app/dashboard
            </div>
          </div>
        </div>

        {/* App body */}
        <div className="flex h-[500px] overflow-hidden bg-background lg:h-[560px]">

          {/* ── Browse pane ─────────────────────────────────── */}
          <div className="flex flex-1 flex-col overflow-hidden">

            {/* Search bar */}
            <div className="border-b border-border/40 bg-background/80 px-3 py-2.5 backdrop-blur">
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5">
                <Search className="size-3.5 shrink-0 text-muted-foreground/60" />
                <span className="text-[11px] text-muted-foreground/50">
                  fintech companies from recent batches…
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-3 border-b border-border/30 bg-muted/20 px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)]">
                <span>Company</span>
                <span>Batch</span>
                <span className="hidden lg:block">Industry</span>
              </div>
              {MOCK_COMPANIES.map((co, i) => (
                <div
                  key={co.name}
                  className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] items-center gap-3 border-b border-border/20 px-4 py-2.5 text-xs transition-colors hover:bg-muted/20"
                  style={{ opacity: 1 - i * 0.08 }}
                >
                  <div>
                    <p className="truncate font-semibold text-foreground">{co.name}</p>
                    <p className="mt-0.5 hidden truncate text-[10px] text-muted-foreground/70 lg:block">
                      {co.oneliner}
                    </p>
                  </div>
                  <span
                    className="w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      borderColor: `${BATCH_COLORS[co.batch] ?? "#888"}55`,
                      color: BATCH_COLORS[co.batch] ?? "#888",
                    }}
                  >
                    {co.batch}
                  </span>
                  <span className="hidden truncate text-[11px] text-muted-foreground/80 lg:block">
                    {co.industry}
                  </span>
                </div>
              ))}
            </div>

            {/* Graph strip */}
            <div className="relative h-[140px] shrink-0 overflow-hidden border-t border-border/30 bg-card/20 lg:h-[160px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_70%)]" />
              <MiniGraph />
              <div className="absolute left-3 top-2 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                <Network className="size-3" />
                Company network
              </div>
            </div>
          </div>

          {/* ── Chat pane ────────────────────────────────────── */}
          <div className="hidden w-[270px] shrink-0 flex-col border-l border-border/40 bg-card/30 lg:flex xl:w-[310px]">
            {/* Chat header */}
            <div className="flex items-center gap-2 border-b border-border/40 bg-background/60 px-3 py-2.5">
              <MessageSquare className="size-3.5 text-primary/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                yc·search assistant
              </span>
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-hidden px-3 py-3">
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 px-3 py-2 text-[11px] leading-relaxed text-foreground">
                  Show me fintech companies from recent batches
                </div>
              </div>

              {/* Assistant response */}
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  Here are 5 YC fintech companies — note that 3 are from 2019 batches:
                </p>
                {MOCK_COMPANIES.slice(0, 3).map((co) => (
                  <div
                    key={co.name}
                    className="rounded-xl border border-border/50 bg-card/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-foreground">{co.name}</span>
                      <span
                        className="rounded-full border px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          borderColor: `${BATCH_COLORS[co.batch] ?? "#888"}55`,
                          color: BATCH_COLORS[co.batch] ?? "#888",
                        }}
                      >
                        {co.batch}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">
                      {co.oneliner}
                    </p>
                  </div>
                ))}

                {/* Typing indicator */}
                <div className="flex items-center gap-1 px-1 pt-1">
                  <span className="size-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="border-t border-border/40 p-3">
              <div className="rounded-full border border-border/60 bg-background/70 px-3 py-2 text-[10px] text-muted-foreground/50">
                What kind of YC company are you looking for?
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fade-out at the bottom so it feels like a preview, not a screenshot */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
      />
    </section>
  );
}
