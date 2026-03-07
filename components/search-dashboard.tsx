"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  LayoutGrid,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { BatchAnalyticsChart } from "./dashboard/batch-analytics-chart";
import { ResultsCardGrid } from "./dashboard/results-card-grid";
import { ResultsTable } from "./dashboard/results-table";
import type {
  AnalyticsResponse,
  ChatResponse,
  FacetItem,
  FacetsPayload,
  SearchResponse,
} from "./dashboard/types";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { cn } from "../lib/utils";

type SearchMode = "keyword" | "semantic";
type AnalyticsColorBy = "none" | "tags" | "industries";
type ResultsView = "cards" | "table";
type SortOption = "relevance" | "newest" | "team_size" | "name";
type DashboardTab = "results" | "analytics";

const QUERY_EXAMPLES = [
  "B2B SaaS companies in healthcare",
  "Find YC companies working on climate tech",
  "AI developer tools hiring in Europe",
  "Top fintech infrastructure startups",
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

export function SearchDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<DashboardTab>((searchParams.get("tab") as DashboardTab) ?? "results");
  const [mode, setMode] = useState<SearchMode>((searchParams.get("mode") as SearchMode) ?? "keyword");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>((searchParams.get("sort") as SortOption) ?? "relevance");
  const [view, setView] = useState<ResultsView>((searchParams.get("view") as ResultsView) ?? "table");
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
  const [analyticsColorBy, setAnalyticsColorBy] = useState<AnalyticsColorBy>(
    (searchParams.get("colorBy") as AnalyticsColorBy) ?? "none",
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

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
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    setFacetsLoading(true);
    fetch("/api/facets")
      .then((response) => response.json())
      .then((payload) => {
        setFacets(payload);
        setError(null);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Could not load facets";
        setError(message);
      })
      .finally(() => setFacetsLoading(false));
  }, []);

  useEffect(() => {
    if (query.trim()) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % QUERY_EXAMPLES.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [query]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    params.set("mode", mode);
    params.set("sort", sort);
    params.set("view", view);
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
    activeTab,
    analyticsColorBy,
    batches,
    industries,
    isHiring,
    mode,
    nonprofit,
    page,
    query,
    regions,
    sort,
    stages,
    tags,
    topCompany,
    view,
    years,
  ]);

  const returnToPath = useMemo(() => `/?${queryString}`, [queryString]);

  useEffect(() => {
    const endpoint = mode === "semantic" ? "/api/semantic-search" : "/api/search";
    setResultsLoading(true);

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
      })
      .finally(() => setResultsLoading(false));

    router.replace(`/?${queryString}`, { scroll: false });
  }, [mode, queryString, router]);

  useEffect(() => {
    if (activeTab !== "analytics") {
      return;
    }

    const params = new URLSearchParams(queryString);
    params.set("colorBy", analyticsColorBy);
    params.set("topN", "8");
    setAnalyticsLoading(true);

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
      })
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab, analyticsColorBy, queryString]);

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

  async function askDatasetQuestion() {
    const question = chatQuestion.trim();
    if (!question) {
      return;
    }

    setChatLoading(true);
    setChatError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          topK: 8,
          filters: {
            tags,
            industries,
            batches,
            years,
            stages,
            regions,
            isHiring,
            nonprofit,
            topCompany,
          },
        }),
      });
      const payload = (await response.json()) as ChatResponse & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to answer question");
      }
      setChatResponse(payload);
    } catch (chatRequestError) {
      const message = chatRequestError instanceof Error ? chatRequestError.message : "Failed to answer question";
      setChatError(message);
    } finally {
      setChatLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const activeFilters = [
    ...tags.map((value) => ({ key: `tag-${value}`, label: value, onRemove: () => addOrToggleTag(value) })),
    ...industries.map((value) => ({
      key: `industry-${value}`,
      label: value,
      onRemove: () => addOrToggleIndustry(value),
    })),
    ...batches.map((value) => ({ key: `batch-${value}`, label: value, onRemove: () => addOrToggleBatch(value) })),
    ...years.map((value) => ({
      key: `year-${value}`,
      label: String(value),
      onRemove: () => {
        setPage(1);
        toggleArrayValue(value, years, setYears);
      },
    })),
    ...stages.map((value) => ({
      key: `stage-${value}`,
      label: value,
      onRemove: () => {
        setPage(1);
        toggleArrayValue(value, stages, setStages);
      },
    })),
    ...regions.map((value) => ({
      key: `region-${value}`,
      label: value,
      onRemove: () => {
        setPage(1);
        toggleArrayValue(value, regions, setRegions);
      },
    })),
    ...(isHiring
      ? [
          {
            key: "hiring",
            label: "Hiring only",
            onRemove: () => {
              setPage(1);
              setIsHiring(false);
            },
          },
        ]
      : []),
    ...(nonprofit
      ? [
          {
            key: "nonprofit",
            label: "Nonprofit only",
            onRemove: () => {
              setPage(1);
              setNonprofit(false);
            },
          },
        ]
      : []),
    ...(topCompany
      ? [
          {
            key: "top-company",
            label: "Top companies",
            onRemove: () => {
              setPage(1);
              setTopCompany(false);
            },
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">YC Search</h1>
          <ThemeToggle />
        </header>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-border/70 bg-card/95 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder=""
                  className="h-16 rounded-[22px] border-border/70 bg-background/70 pl-12 pr-4 text-base shadow-none"
                />
                {!query ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-12 right-4 flex items-center text-base text-muted-foreground/80 transition-opacity",
                      searchFocused ? "opacity-100" : "opacity-90",
                    )}
                  >
                    <span className="truncate">
                      <span className="mr-2 text-muted-foreground/50">Try</span>
                      {QUERY_EXAMPLES[placeholderIndex]}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  options={[
                    { value: "keyword", label: "Keyword" },
                    { value: "semantic", label: "Semantic" },
                  ]}
                  value={mode}
                  onChange={(next) => {
                    setPage(1);
                    setMode(next as SearchMode);
                  }}
                />
                <SegmentedControl
                  options={[
                    { value: "table", label: "Table", icon: <TableProperties className="size-3.5" /> },
                    { value: "cards", label: "Cards", icon: <LayoutGrid className="size-3.5" /> },
                  ]}
                  value={view}
                  onChange={(next) => setView(next as ResultsView)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  compact
                  options={[
                    { value: "results", label: "Results" },
                    { value: "analytics", label: "Analytics" },
                  ]}
                  value={activeTab}
                  onChange={(next) => setActiveTab(next as DashboardTab)}
                />
                <SegmentedControl
                  compact
                  options={[
                    { value: "relevance", label: "Relevance" },
                    { value: "newest", label: "Newest" },
                    { value: "team_size", label: "Team" },
                    { value: "name", label: "Name" },
                  ]}
                  value={sort}
                  onChange={(next) => {
                    setPage(1);
                    setSort(next as SortOption);
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CompactToggle
                  label="Hiring"
                  checked={isHiring}
                  onCheckedChange={(checked) => {
                    setPage(1);
                    setIsHiring(checked);
                  }}
                />
                <CompactToggle
                  label="Nonprofit"
                  checked={nonprofit}
                  onCheckedChange={(checked) => {
                    setPage(1);
                    setNonprofit(checked);
                  }}
                />
                <CompactToggle
                  label="Top"
                  checked={topCompany}
                  onCheckedChange={(checked) => {
                    setPage(1);
                    setTopCompany(checked);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters((current) => !current)}
                  className="rounded-full"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={resetAllFilters} className="rounded-full">
                  <RefreshCcw className="size-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.onRemove}
                  className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {filter.label} ×
                </button>
              ))}
            </div>
          ) : null}

          {showAdvancedFilters ? (
            <Card className="border-border/70 bg-card/95">
              <CardContent className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-5">
                <FacetChecklist
                  title="Tags"
                  items={pickTopFacets(facets?.tags ?? [], 20)}
                  selected={tags}
                  loading={facetsLoading}
                  onToggle={(value) => {
                    setPage(1);
                    toggleArrayValue(value, tags, setTags);
                  }}
                />
                <FacetChecklist
                  title="Industries"
                  items={pickTopFacets(facets?.industries ?? [], 16)}
                  selected={industries}
                  loading={facetsLoading}
                  onToggle={(value) => {
                    setPage(1);
                    toggleArrayValue(value, industries, setIndustries);
                  }}
                />
                <FacetChecklist
                  title="Years"
                  items={pickTopFacets(facets?.years ?? [], 16)}
                  selected={years}
                  loading={facetsLoading}
                  onToggle={(value) => {
                    setPage(1);
                    toggleArrayValue(Number(value), years, setYears);
                  }}
                />
                <FacetChecklist
                  title="Stages"
                  items={pickTopFacets(facets?.stages ?? [], 12)}
                  selected={stages}
                  loading={facetsLoading}
                  onToggle={(value) => {
                    setPage(1);
                    toggleArrayValue(value, stages, setStages);
                  }}
                />
                <FacetChecklist
                  title="Regions"
                  items={pickTopFacets(facets?.regions ?? [], 12)}
                  selected={regions}
                  loading={facetsLoading}
                  onToggle={(value) => {
                    setPage(1);
                    toggleArrayValue(value, regions, setRegions);
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
        </section>

        {activeTab === "results" ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{results.total.toLocaleString()} companies</p>
                <p className="text-xs text-muted-foreground">
                  {mode === "semantic" ? "Semantic" : "Keyword"} search, page {results.page} of {totalPages}
                </p>
              </div>
              <PaginationControls
                page={page}
                total={results.total}
                pageSize={results.pageSize}
                onPrev={() => setPage((previous) => Math.max(1, previous - 1))}
                onNext={() => setPage((previous) => previous + 1)}
              />
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            {resultsLoading ? (
              <LoadingState label="Refreshing results..." />
            ) : results.results.length === 0 ? (
              <EmptyState />
            ) : view === "cards" ? (
              <ResultsCardGrid
                results={results.results}
                returnToPath={returnToPath}
                selectedTags={tags}
                selectedIndustries={industries}
                onToggleTag={addOrToggleTag}
                onToggleIndustry={addOrToggleIndustry}
              />
            ) : (
              <ResultsTable
                results={results.results}
                returnToPath={returnToPath}
                selectedTags={tags}
                selectedIndustries={industries}
                sort={sort}
                onSortChange={(nextSort) => {
                  setPage(1);
                  setSort(nextSort);
                }}
                onToggleTag={addOrToggleTag}
                onToggleIndustry={addOrToggleIndustry}
              />
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle className="text-base">Batch analytics</CardTitle>
                    <CardDescription>
                      Charts live here so the main results view stays search-first and table-first.
                    </CardDescription>
                  </div>
                  <SegmentedControl
                    compact
                    options={[
                      { value: "none", label: "None" },
                      { value: "tags", label: "Tags" },
                      { value: "industries", label: "Industries" },
                    ]}
                    value={analyticsColorBy}
                    onChange={(next) => setAnalyticsColorBy(next as AnalyticsColorBy)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {batches.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {batches.map((batch) => (
                      <button
                        key={`batch-pill-${batch}`}
                        type="button"
                        onClick={() => addOrToggleBatch(batch)}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary transition hover:bg-primary/15"
                      >
                        {batch}
                      </button>
                    ))}
                  </div>
                ) : null}

                {analyticsError ? (
                  <ErrorBanner message={analyticsError} />
                ) : analyticsLoading ? (
                  <LoadingState label="Refreshing analytics..." />
                ) : (
                  <BatchAnalyticsChart
                    analytics={analytics}
                    analyticsColorBy={analyticsColorBy}
                    hoveredSeries={hoveredSeries}
                    onHoverSeries={setHoveredSeries}
                    onLeaveSeries={() => setHoveredSeries(null)}
                    onLegendDrilldown={handleLegendDrilldown}
                    onBarDrilldown={handleBarDrilldown}
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Filtered results</p>
                  <p className="text-xs text-muted-foreground">
                    Keep chart drilldowns and table browsing in one secondary workspace.
                  </p>
                </div>
                <PaginationControls
                  page={page}
                  total={results.total}
                  pageSize={results.pageSize}
                  onPrev={() => setPage((previous) => Math.max(1, previous - 1))}
                  onNext={() => setPage((previous) => previous + 1)}
                />
              </div>

              {resultsLoading ? (
                <LoadingState label="Refreshing results..." />
              ) : view === "cards" ? (
                <ResultsCardGrid
                  results={results.results}
                  returnToPath={returnToPath}
                  selectedTags={tags}
                  selectedIndustries={industries}
                  onToggleTag={addOrToggleTag}
                  onToggleIndustry={addOrToggleIndustry}
                />
              ) : (
                <ResultsTable
                  results={results.results}
                  returnToPath={returnToPath}
                  selectedTags={tags}
                  selectedIndustries={industries}
                  sort={sort}
                  onSortChange={(nextSort) => {
                    setPage(1);
                    setSort(nextSort);
                  }}
                  onToggleTag={addOrToggleTag}
                  onToggleIndustry={addOrToggleIndustry}
                />
              )}
            </div>

            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
                    <Brain className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Ask YC Chat</CardTitle>
                    <CardDescription>
                      Secondary analysis workspace for questions grounded in your current filters.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <Input
                    value={chatQuestion}
                    onChange={(event) => setChatQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void askDatasetQuestion();
                      }
                    }}
                    placeholder="Which companies here look strongest, and which links should I open first?"
                    className="h-12 flex-1 rounded-2xl"
                  />
                  <Button
                    type="button"
                    onClick={() => void askDatasetQuestion()}
                    disabled={chatLoading || !chatQuestion.trim()}
                    className="h-12 rounded-2xl px-5"
                  >
                    {chatLoading ? "Thinking..." : "Ask"}
                  </Button>
                </div>

                {chatError ? <ErrorBanner message={chatError} /> : null}

                {chatResponse?.answer ? (
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Answer</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{chatResponse.answer}</p>
                    </div>

                    {chatResponse.citations.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
                        {chatResponse.citations.map((citation) => (
                          <article
                            key={`chat-citation-${citation.id}`}
                            className="rounded-2xl border border-border/70 bg-card/90 p-4"
                          >
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`${citation.companyPage}?returnTo=${encodeURIComponent(returnToPath)}`)
                                }
                                className="text-left text-sm font-semibold hover:text-primary"
                              >
                                {citation.name}
                              </button>
                              <p className="mt-1 text-sm text-muted-foreground">{citation.whyRelevant}</p>
                            </div>
                            {citation.urls.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {citation.urls.map((url) => (
                                  <a
                                    key={`${citation.id}-${url}`}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                                  >
                                    {url}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full border border-border/70 bg-background/70 p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === value ? "secondary" : "ghost"}
          size={compact ? "sm" : "default"}
          onClick={() => onChange(option.value)}
          className="rounded-full"
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function CompactToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PaginationControls({
  page,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 p-1">
      <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={onPrev} className="rounded-full">
        Prev
      </Button>
      <span className="px-2 text-xs text-muted-foreground">
        {page}/{Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={page * pageSize >= total}
        onClick={onNext}
        className="rounded-full"
      >
        Next
      </Button>
    </div>
  );
}

function FacetChecklist<T extends string | number>({
  title,
  items,
  selected,
  loading,
  onToggle,
}: {
  title: string;
  items: FacetItem<T>[];
  selected: T[];
  loading: boolean;
  onToggle: (value: T) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {selected.length ? `${selected.length} active` : "Top facets"}
        </span>
      </div>
      <div className="max-h-48 space-y-1 overflow-auto pr-1">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-xs text-muted-foreground">
            Loading {title.toLowerCase()}...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-xs text-muted-foreground">
            No facets available.
          </div>
        ) : (
          items.map((item) => {
            const checked = selected.includes(item.value);
            return (
              <button
                key={`${title}-${String(item.value)}`}
                type="button"
                onClick={() => onToggle(item.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                  checked
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{String(item.value)}</span>
                <span className={cn("text-[11px]", checked ? "text-primary" : "text-muted-foreground")}>
                  {item.count}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
      <p className="text-lg font-medium">No companies match the current search.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try loosening a filter, switching modes, or broadening the query.
      </p>
    </div>
  );
}
