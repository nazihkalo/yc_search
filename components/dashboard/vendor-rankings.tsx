"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { VendorAnalyticsPayload as VendorAnalyticsResponse } from "../../lib/vendor-analytics";
import { VendorLogo } from "../vendor-logo";
import { Button } from "../ui/button";

export function VendorAnalyticsPanel({
  analytics, isLoading, error, selectedCategory, returnToPath, onCategoryChange, ranking, onRankingChange,
}: {
  analytics: VendorAnalyticsResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  returnToPath: string;
  onCategoryChange: (category: string) => void;
  ranking: "top" | "recent";
  onRankingChange: (ranking: "top" | "recent") => void;
}) {
  const recent = ranking === "recent";
  return (
    <section className="space-y-4" aria-label="Vendor rankings" aria-busy={isLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Vendor rankings</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Explore the providers found in company disclosures and websites.
          </p>
        </div>
        <label className="text-xs font-medium text-muted-foreground">
          <span className="mb-1 block">Category</span>
          <select
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">All categories</option>
            {selectedCategory && !analytics?.categories.some((item) => item.category === selectedCategory) ? (
              <option value={selectedCategory}>{selectedCategory}</option>
            ) : null}
            {analytics?.categories.map((item) => (
              <option key={item.category} value={item.category}>{item.category} ({item.companyCount.toLocaleString()})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rank vendors by">
        {([ ["top", "Top vendors"], ["recent", "Recently discovered"] ] as const).map(([value, label]) => (
          <Button key={value} variant={ranking === value ? "default" : "outline"} size="sm"
            aria-pressed={ranking === value} onClick={() => onRankingChange(value)}>{label}</Button>
        ))}
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {recent
          ? "Ranked by company–vendor pairs first recorded in the last 30 days. Includes backfill discoveries; first recorded dates do not indicate when a company started using a vendor."
          : "Ranked by distinct companies with recorded evidence. Each company counts once per vendor, regardless of how many pages mention it."}
      </p>
      {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading vendor rankings">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />)}
          <span className="sr-only">Loading vendor rankings</span>
        </div>
      ) : analytics ? (
        <>
          <p className="text-xs text-muted-foreground">
            Vendor evidence available for {analytics.coverage.companiesWithVendors.toLocaleString()} of {analytics.coverage.matchedCompanies.toLocaleString()} companies in the selected cohort.
            {" "}Counts reflect observed evidence, not market share or service quality.
          </p>
          {analytics.topVendors.length ? (
            <>
              <div className="flex justify-between gap-3 border-b border-border pb-2 text-xs text-muted-foreground">
                <span>{selectedCategory || "All categories"} · {analytics.totalVendors.toLocaleString()} vendors</span>
                <span>{recent ? "Newly recorded / total companies" : "Companies / share of evidence cohort"}</span>
              </div>
              <ol className="divide-y divide-border">
                {analytics.topVendors.map((vendor, index) => {
                  const share = analytics.coverage.companiesWithVendors
                    ? vendor.companyCount / analytics.coverage.companiesWithVendors * 100 : 0;
                  return (
                    <li key={vendor.id}>
                      <Link href={`/vendors/${vendor.id}?returnTo=${encodeURIComponent(returnToPath)}`}
                        className="group flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                        <VendorLogo name={vendor.name} domain={vendor.domain} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:text-primary">{vendor.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{vendor.category}</p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-sm font-medium">{recent ? `+${vendor.recentCompanyCount.toLocaleString()}` : vendor.companyCount.toLocaleString()}
                            <span className="sr-only"> companies{recent ? " first recorded in the last 30 days" : " with evidence"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{recent ? `${vendor.companyCount.toLocaleString()} total` : `${share.toFixed(1)}%`}</p>
                        </div>
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {analytics.totalVendors > analytics.topVendors.length ? (
                <p className="text-xs text-muted-foreground">Showing the top {analytics.topVendors.length}. Choose a category or search for a vendor to narrow the list.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Select a vendor to see the companies and supporting evidence.</p>
            </>
          ) : (
            <div className="rounded-md border border-border px-4 py-8">
              <p className="font-medium">{recent ? "No new company–vendor pairs recorded in the last 30 days" : "No vendors match these filters"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{recent ? "Try Top vendors to explore existing evidence, or broaden the company filters." : "Try another category, broaden the company filters, or check back as more disclosures are indexed."}</p>
              {selectedCategory ? <Button className="mt-3" variant="outline" size="sm" onClick={() => onCategoryChange("")}>Clear category</Button> : null}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

