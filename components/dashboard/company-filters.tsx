"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { sourceLabel } from "../../lib/company-source";
import type { SearchFilters } from "../../lib/search";
import type { FacetsPayload, FacetItem } from "./types";

function FacetFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format = String,
  loading,
}: {
  label: string;
  options: FacetItem<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  format?: (value: T) => string;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const all = [
    ...options,
    ...selected
      .filter((value) => !options.some((o) => o.value === value))
      .map((value) => ({ value, count: 0 })),
  ];
  const visible = all.filter((option) =>
    format(option.value).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Popover onOpenChange={() => setSearch("")}>
      <PopoverTrigger
        className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring ${selected.length ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background"}`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded bg-primary/15 px-1.5 tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)] p-2"
        aria-label={`${label} filters`}
      >
        <input
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={`Find ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-9 w-full rounded border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          Counts across the full company index
        </p>
        <div className="max-h-64 overflow-y-auto">
          {visible.map((option) => (
            <label
              key={option.value}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() =>
                  onChange(
                    selected.includes(option.value)
                      ? selected.filter((v) => v !== option.value)
                      : [...selected, option.value],
                  )
                }
                className="size-4 accent-primary"
              />
              <span className="min-w-0 flex-1 break-words">
                {format(option.value)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {option.count.toLocaleString()}
              </span>
            </label>
          ))}
          {!visible.length && (
            <p className="p-3 text-sm text-muted-foreground">
              {loading ? "Loading options…" : "No matching options"}
            </p>
          )}
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-2 w-full rounded border border-border p-2 text-xs hover:bg-secondary"
          >
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CompanyFilters({
  facets,
  error,
  filters,
  onChange,
  onClear,
  hasFilters,
}: {
  facets: FacetsPayload | null;
  error?: string | null;
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onClear: () => void;
  hasFilters: boolean;
}) {
  const groups = [
    ["industries", "Industry"],
    ["tags", "Tags"],
    ["batches", "YC batch"],
    ["regions", "Region"],
    ["stages", "Stage"],
    ["sources", "Source"],
  ] as const;
  return (
    <section
      aria-label="Company filters"
      className="space-y-2 border-y border-border/60 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          Filter by
        </span>
        {groups.map(([key, label]) => (
          <FacetFilter
            key={key}
            label={label}
            options={facets?.[key] ?? []}
            selected={filters[key]}
            onChange={(values) => onChange({ [key]: values })}
            format={key === "sources" ? sourceLabel : String}
            loading={!facets && !error}
          />
        ))}
        <FacetFilter
          label="Launch year"
          options={facets?.years ?? []}
          selected={filters.years}
          onChange={(years) => onChange({ years })}
          loading={!facets && !error}
        />
        <Popover>
          <PopoverTrigger
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium hover:bg-secondary ${filters.isHiring || filters.nonprofit || filters.topCompany ? "border-primary/40 bg-primary/10 text-primary" : "border-border"}`}
          >
            Attributes
            <ChevronDown className="size-3.5 opacity-60" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-56 p-2"
            aria-label="Company attributes"
          >
            {(
              [
                ["isHiring", "Hiring"],
                ["nonprofit", "Nonprofit"],
                ["topCompany", "YC top company"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={Boolean(filters[key])}
                  onChange={(e) => onChange({ [key]: e.target.checked })}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 px-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          Filter options could not load. Reload the page to try again.
        </p>
      )}
    </section>
  );
}
