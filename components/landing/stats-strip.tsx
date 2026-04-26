import { initializeDatabase, queryOne } from "../../lib/db";

async function getStats() {
  try {
    await initializeDatabase();
    const [companies, founders, batches, github] = await Promise.all([
      queryOne<{ n: string }>("SELECT COUNT(*)::text AS n FROM companies"),
      queryOne<{ n: string }>("SELECT COUNT(*)::text AS n FROM founders"),
      queryOne<{ n: string }>("SELECT COUNT(DISTINCT batch)::text AS n FROM companies WHERE batch IS NOT NULL"),
      queryOne<{ n: string }>("SELECT COUNT(*)::text AS n FROM founder_github"),
    ]);
    return {
      companies: Number(companies?.n ?? 0),
      founders: Number(founders?.n ?? 0),
      batches: Number(batches?.n ?? 0),
      github: Number(github?.n ?? 0),
    };
  } catch {
    return { companies: 0, founders: 0, batches: 0, github: 0 };
  }
}

function format(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export async function StatsStrip() {
  const stats = await getStats();

  const items = [
    { label: "YC companies", value: stats.companies },
    { label: "Founders indexed", value: stats.founders },
    { label: "GitHub profiles enriched", value: stats.github },
    { label: "Batches covered", value: stats.batches },
  ];

  if (items.every((item) => item.value === 0)) {
    return null;
  }

  return (
    <section className="relative mx-auto w-full max-w-[1280px] px-4 pb-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/50 bg-border/50 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-background/80 px-6 py-5">
            <div className="text-3xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
              {format(item.value)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
