"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import type { Overview } from "../../lib/overview";
import { cn } from "../../lib/utils";
import { selectionKey, useWorkspace, type ExploreSelection } from "./workspace-context";

const BATCHES_COLLAPSED = 10;
const INDUSTRIES_COLLAPSED = 8;

function formatCount(n: number) {
  return n.toLocaleString("en-US");
}

export function useOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then((res) => (res.ok ? (res.json() as Promise<Overview>) : Promise.reject(res.status)))
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { overview, error };
}

export function ExplorePanel({ overview, className }: { overview: Overview | null; className?: string }) {
  const workspace = useWorkspace();
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  const explore = (selection: ExploreSelection) => workspace?.explore(selection);
  const isActive = (selection: ExploreSelection) => workspace?.activeSelection === selectionKey(selection);

  const maxBatch = useMemo(
    () => Math.max(1, ...(overview?.batches ?? []).map((b) => b.count)),
    [overview],
  );

  if (!overview) {
    return (
      <div className={cn("flex flex-col gap-6 p-5", className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
    );
  }

  const batches = showAllBatches ? overview.batches : overview.batches.slice(0, BATCHES_COLLAPSED);
  const industries = showAllIndustries
    ? overview.industries.slice(0, 30)
    : overview.industries.slice(0, INDUSTRIES_COLLAPSED);

  return (
    <div className={cn("flex flex-col gap-7 px-5 py-5", className)}>
      <section aria-label="Totals">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Companies" value={overview.companies} onClick={() => explore({ kind: "all" })} />
          <Stat label="Founders" value={overview.founders} />
          <Stat
            label="Hiring now"
            value={overview.hiring}
            onClick={() => explore({ kind: "hiring" })}
            active={isActive({ kind: "hiring" })}
          />
        </dl>
      </section>

      <section aria-labelledby="explore-years">
        <SectionHeading id="explore-years">Companies per year</SectionHeading>
        <YearChart
          years={overview.years}
          batches={overview.batches}
          onSelectYear={(year, values) => explore({ kind: "batch", values, label: String(year) })}
          activeKey={workspace?.activeSelection ?? null}
        />
      </section>

      <section aria-labelledby="explore-batches">
        <SectionHeading id="explore-batches">Batches</SectionHeading>
        <ul className="-mx-2">
          {batches.map((batch) => {
            const selection: ExploreSelection = { kind: "batch", values: [batch.batch], label: batch.batch };
            return (
              <li key={batch.batch}>
                <ExploreRow
                  label={batch.batch}
                  count={batch.count}
                  ratio={batch.count / maxBatch}
                  active={isActive(selection)}
                  onClick={() => explore(selection)}
                />
              </li>
            );
          })}
        </ul>
        {overview.batches.length > BATCHES_COLLAPSED ? (
          <ShowMore expanded={showAllBatches} onToggle={() => setShowAllBatches((v) => !v)}>
            {showAllBatches ? "Show fewer" : `All ${overview.batches.length} batches`}
          </ShowMore>
        ) : null}
      </section>

      {overview.trendingTags.length > 0 ? (
        <section aria-labelledby="explore-trending">
          <SectionHeading id="explore-trending">Rising in recent batches</SectionHeading>
          <p className="-mt-1 mb-3 text-xs leading-5 text-muted-foreground">
            Tags that show up more in {overview.recentBatchNames.at(-1)} to {overview.recentBatchNames[0]} than
            in YC overall.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {overview.trendingTags.map((tag) => {
              const selection: ExploreSelection = { kind: "tag", value: tag.name };
              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => explore(selection)}
                  className={cn(
                    "inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 text-[13px] transition",
                    isActive(selection)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:border-foreground/40",
                  )}
                >
                  {tag.name}
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      isActive(selection) ? "text-background/70" : "text-primary",
                    )}
                    title={`${tag.growth.toFixed(1)}× more common in recent batches`}
                  >
                    {tag.growth.toFixed(1)}×
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="explore-industries">
        <SectionHeading id="explore-industries">Industries</SectionHeading>
        <ul className="-mx-2">
          {industries.map((industry) => {
            const selection: ExploreSelection = { kind: "industry", value: industry.name };
            return (
              <li key={industry.name}>
                <ExploreRow
                  label={industry.name}
                  count={industry.count}
                  ratio={industry.count / (overview.industries[0]?.count || 1)}
                  active={isActive(selection)}
                  onClick={() => explore(selection)}
                />
              </li>
            );
          })}
        </ul>
        {overview.industries.length > INDUSTRIES_COLLAPSED ? (
          <ShowMore expanded={showAllIndustries} onToggle={() => setShowAllIndustries((v) => !v)}>
            {showAllIndustries ? "Show fewer" : "More industries"}
          </ShowMore>
        ) : null}
      </section>

      <section aria-labelledby="explore-tags">
        <SectionHeading id="explore-tags">Most common tags</SectionHeading>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
          {overview.tags.slice(0, 18).map((tag) => {
            const selection: ExploreSelection = { kind: "tag", value: tag.name };
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => explore(selection)}
                className={cn(
                  "underline-offset-4 transition hover:underline",
                  isActive(selection) ? "font-semibold text-foreground underline" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2.5 text-xs font-medium text-muted-foreground">
      {children}
    </h2>
  );
}

function Stat({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-[26px] leading-none tabular-nums text-foreground">
        {formatCount(value)}
      </dd>
    </>
  );
  if (!onClick) return <div>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group -m-1.5 rounded-md p-1.5 text-left transition hover:bg-muted",
        active && "bg-muted",
      )}
    >
      {content}
    </button>
  );
}

function ExploreRow({
  label,
  count,
  ratio,
  active,
  onClick,
}: {
  label: string;
  count: number;
  ratio: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition",
        active ? "bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      <span className="relative z-10 truncate">{label}</span>
      <span className="relative z-10 flex shrink-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("h-1 rounded-full", active ? "bg-background/40" : "bg-foreground/15 group-hover:bg-primary/60")}
          style={{ width: `${Math.max(4, Math.round(ratio * 48))}px` }}
        />
        <span
          className={cn(
            "w-10 text-right font-mono text-xs tabular-nums",
            active ? "text-background/80" : "text-muted-foreground",
          )}
        >
          {formatCount(count)}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className={cn("size-3.5 opacity-0 transition group-hover:opacity-100", active && "opacity-100")}
        />
      </span>
    </button>
  );
}

function ShowMore({
  expanded,
  onToggle,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
    >
      {children}
      <ChevronDown aria-hidden="true" className={cn("size-3.5 transition", expanded && "rotate-180")} />
    </button>
  );
}

export function YearChart({
  years,
  batches,
  onSelectYear,
  activeKey,
  height = 88,
}: {
  years: Overview["years"];
  batches: Overview["batches"];
  onSelectYear?: (year: number, batchNames: string[]) => void;
  activeKey?: string | null;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...years.map((y) => y.count));
  // The newest year can hold only a handful of early-announced companies, so
  // default to the latest year with a meaningful count instead.
  const latestFull = [...years].reverse().find((y) => y.count >= max * 0.15) ?? years.at(-1);
  const focus = years.find((y) => y.year === hovered) ?? latestFull;
  if (years.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="font-mono tabular-nums text-foreground">{focus?.year}</span>
        <span className="text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{formatCount(focus?.count ?? 0)}</span> companies
        </span>
      </div>
      <div
        className="flex items-end gap-[2px]"
        style={{ height }}
        role="group"
        aria-label="Companies funded per year. Select a year to see its companies."
        onMouseLeave={() => setHovered(null)}
      >
        {years.map((y) => {
          const isActive = activeKey === `batch:${y.year}`;
          const isLatest = y.year === latestFull?.year;
          const names = batches.filter((b) => b.year === y.year).map((b) => b.batch);
          return (
            <button
              key={y.year}
              type="button"
              onMouseEnter={() => setHovered(y.year)}
              onFocus={() => setHovered(y.year)}
              onClick={() => onSelectYear?.(y.year, names)}
              aria-label={`${y.year}: ${y.count} companies`}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[2px] transition-colors",
                  isActive || hovered === y.year
                    ? "bg-primary"
                    : isLatest
                      ? "bg-foreground/70"
                      : "bg-foreground/20 group-hover:bg-foreground/40",
                )}
                style={{ height: `${Math.max(3, (y.count / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
        <span>{years[0]?.year}</span>
        <span>{years.at(-1)?.year}</span>
      </div>
    </div>
  );
}
