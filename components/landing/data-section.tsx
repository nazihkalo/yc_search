import type { Overview } from "../../lib/overview";
import { YearChart } from "../dashboard/explore-panel";

function n(value: number) {
  return value.toLocaleString("en-US");
}

export function DataSection({ overview }: { overview: Overview }) {
  if (overview.companies === 0) return null;

  const peak = overview.years.reduce((best, y) => (y.count > best.count ? y : best), overview.years[0]);
  const topIndustries = overview.industries.slice(0, 7);
  const maxIndustry = topIndustries[0]?.count ?? 1;
  const oldest = overview.recentBatchNames.at(-1);
  const newest = overview.recentBatchNames[0];

  return (
    <section id="data" className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl leading-tight tracking-[-0.01em] sm:text-5xl">What&apos;s in the data</h2>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            Pulled from YC&apos;s public directory every night, then enriched with company websites, founder
            profiles, GitHub activity, and the tools each company uses.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
          <figure>
            <figcaption className="mb-4 flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">Companies funded per year</span>
              {peak ? (
                <span className="text-xs text-muted-foreground">
                  Peak: <span className="font-mono text-foreground">{peak.year}</span> with{" "}
                  <span className="font-mono text-foreground">{n(peak.count)}</span>
                </span>
              ) : null}
            </figcaption>
            <YearChart years={overview.years} batches={overview.batches} height={200} />
          </figure>

          <div>
            <h3 className="mb-4 text-sm font-medium">Largest industries</h3>
            <ul className="space-y-2.5">
              {topIndustries.map((industry) => (
                <li key={industry.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                  <span className="truncate text-sm">{industry.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{n(industry.count)}</span>
                  <span className="col-span-2 h-1 rounded-full bg-muted" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-foreground/60"
                      style={{ width: `${(industry.count / maxIndustry) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {overview.trendingTags.length > 0 ? (
          <div className="mt-16">
            <h3 className="text-sm font-medium">Rising in recent batches</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              How much more often a tag appears in {oldest} to {newest} than across all of YC.
            </p>
            <ol className="mt-5 grid gap-x-10 border-t border-border sm:grid-cols-2 lg:grid-cols-3">
              {overview.trendingTags.slice(0, 9).map((tag, i) => (
                <li key={tag.name} className="flex items-baseline gap-3 border-b border-border py-3">
                  <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-[15px]">{tag.name}</span>
                  <span className="font-mono text-sm tabular-nums text-primary">{tag.growth.toFixed(1)}×</span>
                  <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {n(tag.recent)} cos
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
