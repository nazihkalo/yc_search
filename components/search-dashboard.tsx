"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type FacetItem<T extends string | number = string> = {
  value: T;
  count: number;
};

type FacetsPayload = {
  tags: FacetItem<string>[];
  industries: FacetItem<string>[];
  regions: FacetItem<string>[];
  stages: FacetItem<string>[];
  years: FacetItem<number>[];
};

type CompanyResult = {
  id: number;
  name: string;
  slug: string | null;
  website: string | null;
  one_liner: string | null;
  long_description: string | null;
  batch: string | null;
  stage: string | null;
  industry: string | null;
  all_locations: string | null;
  launched_at: number | null;
  launched_year: number | null;
  team_size: number | null;
  is_hiring: boolean;
  nonprofit: boolean;
  top_company: boolean;
  tags: string[];
  industries: string[];
  regions: string[];
  url: string | null;
  small_logo_thumb_url: string | null;
  status: string | null;
  score?: number;
};

type SearchResponse = {
  total: number;
  page: number;
  pageSize: number;
  results: CompanyResult[];
};

type AnalyticsResponse = {
  colorBy: "none" | "tags" | "industries";
  totalCompanies: number;
  series: string[];
  rows: Array<Record<string, string | number | null>>;
};

const SERIES_COLORS = [
  "#5B8FF9",
  "#61C9A8",
  "#7E92FF",
  "#F3B972",
  "#7CB0A8",
  "#A993F7",
  "#F29C9B",
  "#84BDEB",
  "#BCC4FF",
  "#6FAFA3",
  "#F2A97A",
  "#9F8CF3",
];

function parseCsv(value: string | null) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCsv(items: string[] | number[]) {
  return items.join(",");
}

function parseYears(value: string | null) {
  return parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function pickTopFacets<T extends string | number>(items: FacetItem<T>[], count = 30) {
  return items.slice(0, count);
}

function formatBatchTickLabel(batch: string) {
  const compactMatch = batch.match(/^([WSF])(\d{2})$/i);
  if (compactMatch) {
    return `${compactMatch[1].toUpperCase()}${compactMatch[2]}`;
  }

  const namedMatch = batch.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (namedMatch) {
    const season = namedMatch[1].toLowerCase();
    const seasonShort =
      season === "winter" ? "W" : season === "spring" ? "Sp" : season === "summer" ? "S" : "F";
    return `${seasonShort}${namedMatch[2].slice(2)}`;
  }

  return batch.length > 7 ? batch.slice(0, 7) : batch;
}

export function SearchDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<"keyword" | "semantic">(
    (searchParams.get("mode") as "keyword" | "semantic") ?? "keyword",
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [tags, setTags] = useState<string[]>(parseCsv(searchParams.get("tags")));
  const [industries, setIndustries] = useState<string[]>(parseCsv(searchParams.get("industries")));
  const [batches, setBatches] = useState<string[]>(parseCsv(searchParams.get("batches")));
  const [years, setYears] = useState<number[]>(parseYears(searchParams.get("years")));
  const [regions, setRegions] = useState<string[]>(parseCsv(searchParams.get("regions")));
  const [stages, setStages] = useState<string[]>(parseCsv(searchParams.get("stages")));
  const [isHiring, setIsHiring] = useState(searchParams.get("isHiring") === "1");
  const [nonprofit, setNonprofit] = useState(searchParams.get("nonprofit") === "1");
  const [topCompany, setTopCompany] = useState(searchParams.get("topCompany") === "1");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [analyticsColorBy, setAnalyticsColorBy] = useState<"none" | "tags" | "industries">(
    (searchParams.get("colorBy") as "none" | "tags" | "industries") ?? "none",
  );

  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [facets, setFacets] = useState<FacetsPayload | null>(null);
  const [results, setResults] = useState<SearchResponse>({
    total: 0,
    page: 1,
    pageSize: 20,
    results: [],
  });
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/facets")
      .then((response) => response.json())
      .then((payload) => setFacets(payload))
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Could not load facets";
        setError(message);
      });
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("colorBy", analyticsColorBy);
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (tags.length) {
      params.set("tags", arrayToCsv(tags));
    }
    if (industries.length) {
      params.set("industries", arrayToCsv(industries));
    }
    if (batches.length) {
      params.set("batches", arrayToCsv(batches));
    }
    if (years.length) {
      params.set("years", arrayToCsv(years));
    }
    if (regions.length) {
      params.set("regions", arrayToCsv(regions));
    }
    if (stages.length) {
      params.set("stages", arrayToCsv(stages));
    }
    if (isHiring) {
      params.set("isHiring", "1");
    }
    if (nonprofit) {
      params.set("nonprofit", "1");
    }
    if (topCompany) {
      params.set("topCompany", "1");
    }
    params.set("page", String(page));
    params.set("pageSize", "20");
    return params.toString();
  }, [
    mode,
    query,
    tags,
    industries,
    batches,
    years,
    regions,
    stages,
    isHiring,
    nonprofit,
    topCompany,
    page,
    analyticsColorBy,
  ]);
  const returnToPath = useMemo(() => `/?${queryString}`, [queryString]);

  useEffect(() => {
    const endpoint = mode === "semantic" ? "/api/semantic-search" : "/api/search";

    fetch(`${endpoint}?${queryString}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setError(null);
        setResults(payload);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Search failed";
        setError(message);
      });

    router.replace(`/?${queryString}`);
  }, [queryString, mode, router]);

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    params.set("colorBy", analyticsColorBy);
    params.set("topN", "8");

    fetch(`/api/analytics?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setAnalyticsError(null);
        setAnalytics(payload);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Analytics request failed";
        setAnalyticsError(message);
      });
  }, [analyticsColorBy, queryString]);

  function toggleArrayValue<T extends string | number>(
    value: T,
    values: T[],
    setter: (next: T[]) => void,
  ) {
    if (values.includes(value)) {
      setter(values.filter((item) => item !== value));
      return;
    }
    setter([...values, value]);
  }

  function addOrToggleTag(tag: string) {
    setPage(1);
    toggleArrayValue(tag, tags, setTags);
  }

  function addOrToggleIndustry(industry: string) {
    setPage(1);
    toggleArrayValue(industry, industries, setIndustries);
  }

  function addOrToggleBatch(batch: string) {
    setPage(1);
    toggleArrayValue(batch, batches, setBatches);
  }

  function resetAllFilters() {
    setPage(1);
    setTags([]);
    setIndustries([]);
    setBatches([]);
    setYears([]);
    setRegions([]);
    setStages([]);
    setIsHiring(false);
    setNonprofit(false);
    setTopCompany(false);
  }

  function handleLegendDrilldown(clickedSeries: string | number | undefined) {
    const series = String(clickedSeries ?? "");
    if (!series || series === "total" || series === "Other") {
      return;
    }

    if (analyticsColorBy === "tags") {
      addOrToggleTag(series);
      return;
    }
    if (analyticsColorBy === "industries") {
      addOrToggleIndustry(series);
    }
  }

  function handleBarDrilldown(
    seriesKey: string,
    barPayload: { payload?: Record<string, string | number | null> } | undefined,
  ) {
    const batch = String(barPayload?.payload?.batch ?? "");
    if (batch) {
      addOrToggleBatch(batch);
    }

    if (seriesKey === "total" || seriesKey === "Other") {
      return;
    }

    if (analyticsColorBy === "tags") {
      addOrToggleTag(seriesKey);
      return;
    }
    if (analyticsColorBy === "industries") {
      addOrToggleIndustry(seriesKey);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">YC Search</h1>
        <p className="text-sm text-zinc-600">
          Faceted + semantic search over YC companies and scraped website content.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <button
            type="button"
            onClick={resetAllFilters}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100"
          >
            Reset filters
          </button>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <FilterToggleRow
              label="Hiring only"
              checked={isHiring}
              onToggle={() => {
                setPage(1);
                setIsHiring(!isHiring);
              }}
            />
            <FilterToggleRow
              label="Nonprofit only"
              checked={nonprofit}
              onToggle={() => {
                setPage(1);
                setNonprofit(!nonprofit);
              }}
            />
            <FilterToggleRow
              label="Top companies only"
              checked={topCompany}
              onToggle={() => {
                setPage(1);
                setTopCompany(!topCompany);
              }}
            />
          </div>

          {facets ? (
            <>
              <FacetChecklist
                title="Tags"
                items={pickTopFacets(facets.tags, 24)}
                selected={tags}
                onToggle={(value) => {
                  setPage(1);
                  toggleArrayValue(value, tags, setTags);
                }}
              />
              <FacetChecklist
                title="Industries"
                items={pickTopFacets(facets.industries, 20)}
                selected={industries}
                onToggle={(value) => {
                  setPage(1);
                  toggleArrayValue(value, industries, setIndustries);
                }}
              />
              <FacetChecklist
                title="Years"
                items={pickTopFacets(facets.years, 20)}
                selected={years}
                onToggle={(value) => {
                  setPage(1);
                  toggleArrayValue(Number(value), years, setYears);
                }}
              />
              <FacetChecklist
                title="Stages"
                items={pickTopFacets(facets.stages, 10)}
                selected={stages}
                onToggle={(value) => {
                  setPage(1);
                  toggleArrayValue(value, stages, setStages);
                }}
              />
              <FacetChecklist
                title="Regions"
                items={pickTopFacets(facets.regions, 12)}
                selected={regions}
                onToggle={(value) => {
                  setPage(1);
                  toggleArrayValue(value, regions, setRegions);
                }}
              />
            </>
          ) : null}
        </aside>

        <main className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
            <div>
              <p className="text-sm text-zinc-500">
                {analytics?.totalCompanies.toLocaleString() ?? 0} companies in current selection
              </p>
              <p className="text-xs text-zinc-400">
                Click legend colors and bars to drill down
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Color by</span>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {[
                  { value: "none", label: "None" },
                  { value: "tags", label: "Tags" },
                  { value: "industries", label: "Industries" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setAnalyticsColorBy(option.value as "none" | "tags" | "industries")
                    }
                    className={`rounded-md px-3 py-1 text-sm transition ${
                      analyticsColorBy === option.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {batches.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-600">Batch drilldown</p>
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setBatches([]);
                  }}
                  className="text-xs text-zinc-500 underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {batches.map((batch) => (
                  <button
                    key={`batch-pill-${batch}`}
                    type="button"
                    onClick={() => addOrToggleBatch(batch)}
                    className="rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-800"
                  >
                    {batch}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {analyticsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {analyticsError}
            </div>
          ) : null}

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.rows ?? []} margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="batch"
                    interval="preserveStartEnd"
                    minTickGap={28}
                    tickFormatter={formatBatchTickLabel}
                    angle={-32}
                    textAnchor="end"
                    height={78}
                    tickMargin={10}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend
                    onClick={(entry: { dataKey?: unknown; value?: string | number }) => {
                      const dataKey =
                        typeof entry.dataKey === "string" || typeof entry.dataKey === "number"
                          ? entry.dataKey
                          : undefined;
                      handleLegendDrilldown(dataKey ?? entry.value);
                    }}
                    onMouseEnter={(entry: { dataKey?: unknown; value?: string | number }) => {
                      const dataKey =
                        typeof entry.dataKey === "string" || typeof entry.dataKey === "number"
                          ? String(entry.dataKey)
                          : typeof entry.value === "string" || typeof entry.value === "number"
                            ? String(entry.value)
                            : null;
                      setHoveredSeries(dataKey && dataKey !== "total" ? dataKey : null);
                    }}
                    onMouseLeave={() => setHoveredSeries(null)}
                  />
                  {(analytics?.series ?? []).map((seriesKey, index) => (
                    <Bar
                      key={seriesKey}
                      dataKey={seriesKey}
                      stackId={analyticsColorBy === "none" ? undefined : "batch"}
                      fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                      cursor="pointer"
                      fillOpacity={hoveredSeries && hoveredSeries !== seriesKey ? 0.28 : 1}
                      stroke={hoveredSeries === seriesKey ? "#334155" : undefined}
                      strokeWidth={hoveredSeries === seriesKey ? 1.5 : 0}
                      activeBar={{ stroke: "#0f172a", strokeWidth: 1.5, fillOpacity: 1 }}
                      onMouseEnter={() => setHoveredSeries(seriesKey)}
                      onMouseLeave={() => setHoveredSeries(null)}
                      onClick={(payload) => handleBarDrilldown(seriesKey, payload)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex justify-center">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {[
                  { value: "keyword", label: "Keyword" },
                  { value: "semantic", label: "Semantic" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setMode(option.value as "keyword" | "semantic");
                    }}
                    className={`rounded-md px-3 py-1 text-sm transition ${
                      mode === option.value
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder={
                mode === "semantic"
                  ? "e.g. AI devtools in fintech hiring in Europe"
                  : "e.g. analytics, developer tools, healthcare"
              }
              className="w-full rounded-xl border border-zinc-300 px-4 py-4 text-base shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
            <div>
              <p className="text-sm text-zinc-500">
                {`${results.total.toLocaleString()} results`}
              </p>
              <p className="text-xs text-zinc-400">
                Mode: {mode === "semantic" ? "Semantic" : "Keyword"} | Page {results.page}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Prev
              </button>
              <button
                disabled={results.page * results.pageSize >= results.total}
                className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40"
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3">
            {results.results.map((company) => (
              <article key={company.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/companies/${company.id}?returnTo=${encodeURIComponent(returnToPath)}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(
                            `/companies/${company.id}?returnTo=${encodeURIComponent(returnToPath)}`,
                          );
                        }
                      }}
                      className="cursor-pointer"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {company.small_logo_thumb_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={company.small_logo_thumb_url}
                            alt={`${company.name} logo`}
                            className="h-8 w-8 rounded-sm border border-zinc-200 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                            N/A
                          </div>
                        )}
                        <div>
                          <h2 className="text-lg font-semibold">
                            {company.name}
                          </h2>
                          <p className="mt-1 text-sm text-zinc-600">
                            {company.one_liner ?? "No one-liner available."}
                          </p>
                        </div>
                      </div>
                      {typeof company.score === "number" ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                          score {company.score.toFixed(3)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-700">
                      {company.batch ? <span className="rounded-full bg-zinc-100 px-2 py-1">{company.batch}</span> : null}
                      {company.stage ? <span className="rounded-full bg-zinc-100 px-2 py-1">{company.stage}</span> : null}
                      {company.is_hiring ? <span className="rounded-full bg-emerald-100 px-2 py-1">Hiring</span> : null}
                      {company.nonprofit ? <span className="rounded-full bg-blue-100 px-2 py-1">Nonprofit</span> : null}
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm text-zinc-600">{company.long_description ?? ""}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      {company.industries.slice(0, 4).map((industry) => {
                        const selected = industries.includes(industry);
                        return (
                          <button
                            key={`${company.id}-industry-${industry}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addOrToggleIndustry(industry);
                            }}
                            className={`rounded border px-2 py-1 ${
                              selected
                                ? "border-blue-400 bg-blue-100 text-blue-700"
                                : "border-zinc-200 bg-white hover:bg-zinc-100"
                            }`}
                          >
                            {industry}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                      {company.tags.slice(0, 8).map((tag) => {
                        const selected = tags.includes(tag);
                        return (
                          <button
                            key={`${company.id}-tag-${tag}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addOrToggleTag(tag);
                            }}
                            className={`rounded border px-2 py-1 ${
                              selected
                                ? "border-purple-400 bg-purple-100 text-purple-700"
                                : "border-zinc-200 bg-white hover:bg-zinc-100"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  </article>
                ))}
              </div>
        </main>
      </div>
    </div>
  );
}

function FacetChecklist<T extends string | number>({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: FacetItem<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="max-h-40 space-y-1 overflow-auto pr-1">
        {items.map((item) => {
          const checked = selected.includes(item.value);
          return (
            <button
              key={`${title}-${String(item.value)}`}
              type="button"
              onClick={() => onToggle(item.value)}
              className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
                checked
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    checked
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-zinc-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                {String(item.value)}
              </span>
              <span className="text-zinc-400">{item.count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FilterToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-sm transition ${
        checked
          ? "border-blue-300 bg-blue-50 text-blue-800"
          : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
          checked
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-zinc-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}
