"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Brain,
  LayoutGrid,
  Search,
  TableProperties,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { BatchAnalyticsChart } from "./dashboard/batch-analytics-chart";
import { ResultsCardGrid } from "./dashboard/results-card-grid";
import { ResultsNikoPreviewTable } from "./dashboard/results-niko-preview-table";
import type {
  AnalyticsResponse,
  ChatResponse,
  FacetItem,
  FacetsPayload,
  SearchResponse,
  TableColumnKey,
} from "./dashboard/types";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

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

const CARD_PAGE_SIZE = 24;
const DEFAULT_TABLE_PAGE_SIZE = 50;
const TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = [
  "score",
  "industries",
  "tags",
  "batch",
  "stage",
  "team_size",
  "status",
  "links",
];
const ALL_TABLE_COLUMNS: Array<{ key: TableColumnKey; label: string }> = [
  { key: "score", label: "Score" },
  { key: "industries", label: "Industries" },
  { key: "tags", label: "Tags" },
  { key: "batch", label: "Batch" },
  { key: "stage", label: "Stage" },
  { key: "team_size", label: "Team size" },
  { key: "status", label: "Status" },
  { key: "links", label: "Links" },
  { key: "location", label: "Location" },
  { key: "launched_year", label: "Launched year" },
];
const SEARCH_CACHE_PREFIX = "yc-search:results:";

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

function parseTablePageSize(value: string | null) {
  const parsed = Number(value ?? DEFAULT_TABLE_PAGE_SIZE);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TABLE_PAGE_SIZE;
  }

  return Math.min(100, Math.max(1, parsed));
}

function parseTableColumns(value: string | null) {
  const requested = parseCsv(value).filter((item): item is TableColumnKey =>
    ALL_TABLE_COLUMNS.some((column) => column.key === item),
  );

  return requested.length > 0 ? requested : DEFAULT_TABLE_COLUMNS;
}

function pickTopFacets<T extends string | number>(items: FacetItem<T>[], count = 30) {
  return items.slice(0, count);
}

function getCachedSearchResponse(cacheKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(`${SEARCH_CACHE_PREFIX}${cacheKey}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SearchResponse;
  } catch {
    return null;
  }
}

function setCachedSearchResponse(cacheKey: string, payload: SearchResponse) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(`${SEARCH_CACHE_PREFIX}${cacheKey}`, JSON.stringify(payload));
  } catch {
    // Ignore quota/cache failures.
  }
}

export function SearchDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<DashboardTab>((searchParams.get("tab") as DashboardTab) ?? "results");
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
  const [tablePageSize, setTablePageSize] = useState(parseTablePageSize(searchParams.get("pageSize")));
  const [visibleTableColumns, setVisibleTableColumns] = useState<TableColumnKey[]>(
    parseTableColumns(searchParams.get("columns")),
  );
  const [analyticsColorBy, setAnalyticsColorBy] = useState<AnalyticsColorBy>(
    (searchParams.get("colorBy") as AnalyticsColorBy) ?? "none",
  );
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
  const [resultsLoading, setResultsLoading] = useState(false);
  const [loadingMoreCards, setLoadingMoreCards] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/facets")
      .then((response) => response.json())
      .then((payload) => {
        setFacets(payload);
        setError(null);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Could not load facets";
        setError(message);
      });
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

  const baseQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    params.set("sort", sort);
    params.set("view", view);
    params.set("colorBy", analyticsColorBy);
    params.set("columns", arrayToCsv(visibleTableColumns));
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
    return params.toString();
  }, [
    activeTab,
    analyticsColorBy,
    batches,
    industries,
    isHiring,
    nonprofit,
    query,
    regions,
    sort,
    stages,
    tags,
    topCompany,
    visibleTableColumns,
    view,
    years,
  ]);

  const tableQueryString = useMemo(() => {
    const params = new URLSearchParams(baseQueryString);
    params.set("page", String(page));
    params.set("pageSize", String(tablePageSize));
    return params.toString();
  }, [baseQueryString, page, tablePageSize]);

  const cardQueryString = useMemo(() => {
    const params = new URLSearchParams(baseQueryString);
    params.set("page", "1");
    params.set("pageSize", String(CARD_PAGE_SIZE));
    return params.toString();
  }, [baseQueryString]);

  const returnToPath = useMemo(
    () => `/?${view === "table" ? tableQueryString : baseQueryString}`,
    [baseQueryString, tableQueryString, view],
  );

  useEffect(() => {
    setResultsLoading(true);
    setLoadingMoreCards(false);

    const queryString = view === "cards" ? cardQueryString : tableQueryString;
    const cached = view === "table" ? getCachedSearchResponse(queryString) : null;
    if (cached) {
      setResults(cached);
      setError(null);
    }

    fetch(`/api/search?${queryString}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setError(null);
        setResults(payload);
        if (view === "table") {
          setCachedSearchResponse(queryString, payload);
        }
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Search failed";
        setError(message);
      })
      .finally(() => setResultsLoading(false));
  }, [cardQueryString, tableQueryString, view]);

  useEffect(() => {
    const params = new URLSearchParams(baseQueryString);
    if (view === "table") {
      params.set("page", String(page));
      params.set("pageSize", String(tablePageSize));
    }

    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [baseQueryString, page, router, tablePageSize, view]);

  useEffect(() => {
    if (activeTab !== "analytics") {
      return;
    }

    const params = new URLSearchParams(baseQueryString);
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
  }, [activeTab, analyticsColorBy, baseQueryString]);

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

  const loadMoreCards = useCallback(async () => {
    if (view !== "cards" || resultsLoading || loadingMoreCards || results.results.length >= results.total) {
      return;
    }

    const nextPage = results.page + 1;
    const params = new URLSearchParams(baseQueryString);
    params.set("page", String(nextPage));
    params.set("pageSize", String(CARD_PAGE_SIZE));

    setLoadingMoreCards(true);
    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      const payload = (await response.json()) as SearchResponse & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Search failed");
      }

      setError(null);
      setResults((current) => ({
        total: payload.total,
        page: payload.page,
        pageSize: payload.pageSize,
        results: [...current.results, ...payload.results],
      }));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Search failed";
      setError(message);
    } finally {
      setLoadingMoreCards(false);
    }
  }, [baseQueryString, loadingMoreCards, results.page, results.results.length, results.total, resultsLoading, view]);

  useEffect(() => {
    if (view !== "cards") {
      return;
    }

    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting) {
          void loadMoreCards();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMoreCards, view]);

  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const activeFilters = [
    ...tags.map((value) => ({ key: `tag-${value}`, label: value, onRemove: () => addOrToggleTag(value) })),
    ...industries.map((value) => ({
      key: `industry-${value}`,
      label: value,
      onRemove: () => addOrToggleIndustry(value),
    })),
    ...batches.map((value) => ({
      key: `batch-${value}`,
      label: `Batch ${value}`,
      onRemove: () => addOrToggleBatch(value),
    })),
    ...years.map((value) => ({
      key: `year-${value}`,
      label: `Year ${value}`,
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
          <div className="flex min-w-0 items-center gap-4">
            <Image
              src="/logos/yc_search_logo.svg"
              alt="YC Search logo"
              width={56}
              height={56}
              className="size-14 rounded-2xl border border-border/70 object-cover shadow-sm"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">YC Search</h1>
              <p className="text-sm text-muted-foreground">Hybrid keyword + semantic search for YC companies.</p>
            </div>
          </div>
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

              <ControlGroup label="Display" className="lg:w-auto">
                <SegmentedControl
                  fullWidth
                  options={[
                    { value: "table", label: "Table", icon: <TableProperties className="size-3.5" /> },
                    { value: "cards", label: "Cards", icon: <LayoutGrid className="size-3.5" /> },
                  ]}
                  value={view}
                  onChange={(next) => setView(next as ResultsView)}
                />
              </ControlGroup>
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

        </section>

        {activeTab === "results" ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{results.total.toLocaleString()} companies</p>
                <p className="text-xs text-muted-foreground">
                  {view === "cards"
                    ? `${results.results.length.toLocaleString()} loaded`
                    : `Hybrid search, page ${results.page} of ${totalPages}`}
                </p>
              </div>
              {view === "cards" ? (
                <div className="text-xs text-muted-foreground">
                  {results.results.length < results.total ? "Scroll to load more" : "All matching cards loaded"}
                </div>
              ) : null}
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            {resultsLoading && results.results.length === 0 ? (
              <LoadingState label="Refreshing results..." />
            ) : results.results.length === 0 ? (
              <EmptyState />
            ) : view === "cards" ? (
              <>
                <ResultsControlStrip
                  activeTab={activeTab}
                  onActiveTabChange={setActiveTab}
                  sort={sort}
                  onSortChange={(nextSort) => {
                    setPage(1);
                    setSort(nextSort);
                  }}
                  view={view}
                  onViewChange={setView}
                />
                <ResultsCardGrid
                  results={results.results}
                  returnToPath={returnToPath}
                  selectedTags={tags}
                  selectedIndustries={industries}
                  onToggleTag={addOrToggleTag}
                  onToggleIndustry={addOrToggleIndustry}
                />
                <div ref={loadMoreRef} className="h-4" />
                {loadingMoreCards ? <LoadingState label="Loading more companies..." /> : null}
              </>
            ) : (
              <ResultsNikoPreviewTable
                results={results.results}
                total={results.total}
                page={page}
                pageSize={results.pageSize}
                pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
                returnToPath={returnToPath}
                sort={sort}
                visibleColumns={visibleTableColumns}
                selectedTags={tags}
                selectedIndustries={industries}
                selectedBatches={batches}
                selectedStages={stages}
                selectedRegions={regions}
                isHiring={isHiring}
                topCompany={topCompany}
                nonprofit={nonprofit}
                tagOptions={pickTopFacets(facets?.tags ?? [], 20)}
                industryOptions={pickTopFacets(facets?.industries ?? [], 16)}
                batchOptions={pickTopFacets(facets?.batches ?? [], 20)}
                stageOptions={pickTopFacets(facets?.stages ?? [], 12)}
                regionOptions={pickTopFacets(facets?.regions ?? [], 12)}
                isLoading={resultsLoading}
                onSortChange={(nextSort) => {
                  setPage(1);
                  setSort(nextSort);
                }}
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => {
                  setPage(1);
                  setTablePageSize(nextSize);
                }}
                onVisibleColumnsChange={setVisibleTableColumns}
                onYearsChange={(nextYears) => {
                  setPage(1);
                  setYears(nextYears);
                }}
                onTagsChange={(nextTags) => {
                  setPage(1);
                  setTags(nextTags);
                }}
                onIndustriesChange={(nextIndustries) => {
                  setPage(1);
                  setIndustries(nextIndustries);
                }}
                onBatchesChange={(nextBatches) => {
                  setPage(1);
                  setBatches(nextBatches);
                }}
                onStagesChange={(nextStages) => {
                  setPage(1);
                  setStages(nextStages);
                }}
                onRegionsChange={(nextRegions) => {
                  setPage(1);
                  setRegions(nextRegions);
                }}
                onStatusFlagsChange={(nextStatus) => {
                  setPage(1);
                  setIsHiring(nextStatus.isHiring);
                  setTopCompany(nextStatus.topCompany);
                  setNonprofit(nextStatus.nonprofit);
                }}
                selectedYears={years}
                toolbarPrefix={
                  <ResultsControlStrip
                    activeTab={activeTab}
                    onActiveTabChange={setActiveTab}
                    sort={sort}
                    onSortChange={(nextSort) => {
                      setPage(1);
                      setSort(nextSort);
                    }}
                    view={view}
                    onViewChange={setView}
                  />
                }
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
                {view === "cards" ? (
                  <div className="text-xs text-muted-foreground">
                    {results.results.length.toLocaleString()} of {results.total.toLocaleString()} loaded
                  </div>
                ) : null}
              </div>

              {resultsLoading && results.results.length === 0 ? (
                <LoadingState label="Refreshing results..." />
              ) : view === "cards" ? (
                <>
                  <ResultsControlStrip
                    activeTab={activeTab}
                    onActiveTabChange={setActiveTab}
                    sort={sort}
                    onSortChange={(nextSort) => {
                      setPage(1);
                      setSort(nextSort);
                    }}
                    view={view}
                    onViewChange={setView}
                  />
                  <ResultsCardGrid
                    results={results.results}
                    returnToPath={returnToPath}
                    selectedTags={tags}
                    selectedIndustries={industries}
                    onToggleTag={addOrToggleTag}
                    onToggleIndustry={addOrToggleIndustry}
                  />
                  <div ref={loadMoreRef} className="h-4" />
                  {loadingMoreCards ? <LoadingState label="Loading more companies..." /> : null}
                </>
              ) : (
                <ResultsNikoPreviewTable
                  results={results.results}
                  total={results.total}
                  page={page}
                  pageSize={results.pageSize}
                  pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
                  returnToPath={returnToPath}
                  sort={sort}
                  visibleColumns={visibleTableColumns}
                  selectedTags={tags}
                  selectedIndustries={industries}
                  selectedBatches={batches}
                  selectedStages={stages}
                  selectedRegions={regions}
                  isHiring={isHiring}
                  topCompany={topCompany}
                  nonprofit={nonprofit}
                  tagOptions={pickTopFacets(facets?.tags ?? [], 20)}
                  industryOptions={pickTopFacets(facets?.industries ?? [], 16)}
                  batchOptions={pickTopFacets(facets?.batches ?? [], 20)}
                  stageOptions={pickTopFacets(facets?.stages ?? [], 12)}
                  regionOptions={pickTopFacets(facets?.regions ?? [], 12)}
                  isLoading={resultsLoading}
                  onSortChange={(nextSort) => {
                    setPage(1);
                    setSort(nextSort);
                  }}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPage(1);
                    setTablePageSize(nextSize);
                  }}
                  onVisibleColumnsChange={setVisibleTableColumns}
                  onYearsChange={(nextYears) => {
                    setPage(1);
                    setYears(nextYears);
                  }}
                  onTagsChange={(nextTags) => {
                    setPage(1);
                    setTags(nextTags);
                  }}
                  onIndustriesChange={(nextIndustries) => {
                    setPage(1);
                    setIndustries(nextIndustries);
                  }}
                  onBatchesChange={(nextBatches) => {
                    setPage(1);
                    setBatches(nextBatches);
                  }}
                  onStagesChange={(nextStages) => {
                    setPage(1);
                    setStages(nextStages);
                  }}
                  onRegionsChange={(nextRegions) => {
                    setPage(1);
                    setRegions(nextRegions);
                  }}
                  onStatusFlagsChange={(nextStatus) => {
                    setPage(1);
                    setIsHiring(nextStatus.isHiring);
                    setTopCompany(nextStatus.topCompany);
                    setNonprofit(nextStatus.nonprofit);
                  }}
                  selectedYears={years}
                  toolbarPrefix={
                    <ResultsControlStrip
                      activeTab={activeTab}
                      onActiveTabChange={setActiveTab}
                      sort={sort}
                      onSortChange={(nextSort) => {
                        setPage(1);
                        setSort(nextSort);
                      }}
                      view={view}
                      onViewChange={setView}
                    />
                  }
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
  fullWidth = false,
}: {
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const useGridOnMobile = fullWidth && options.length > 2;

  return (
    <div
      className={cn(
        "rounded-full border border-border/70 bg-background/70 p-1",
        fullWidth
          ? useGridOnMobile
            ? "grid w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto"
            : "flex w-full"
          : "inline-flex flex-wrap",
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === value ? "secondary" : "ghost"}
          size={compact ? "sm" : "default"}
          onClick={() => onChange(option.value)}
          className={cn("rounded-full", fullWidth && "w-full justify-center", !useGridOnMobile && fullWidth && "flex-1")}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ControlGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ResultsControlStrip({
  activeTab,
  onActiveTabChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  activeTab: DashboardTab;
  onActiveTabChange: (next: DashboardTab) => void;
  sort: SortOption;
  onSortChange: (next: SortOption) => void;
  view: ResultsView;
  onViewChange: (next: ResultsView) => void;
}) {
  return (
    <>
      <ControlGroup label="Browse">
        <SegmentedControl
          compact
          options={[
            { value: "results", label: "Results" },
            { value: "analytics", label: "Analytics" },
          ]}
          value={activeTab}
          onChange={(next) => onActiveTabChange(next as DashboardTab)}
        />
      </ControlGroup>

      <ControlGroup label="Sort">
        <SegmentedControl
          compact
          options={[
            { value: "relevance", label: "Relevance" },
            { value: "newest", label: "Newest" },
            { value: "team_size", label: "Team" },
            { value: "name", label: "Name" },
          ]}
          value={sort}
          onChange={(next) => onSortChange(next as SortOption)}
        />
      </ControlGroup>

      <ControlGroup label="Display">
        <SegmentedControl
          compact
          options={[
            { value: "table", label: "Table", icon: <TableProperties className="size-3.5" /> },
            { value: "cards", label: "Cards", icon: <LayoutGrid className="size-3.5" /> },
          ]}
          value={view}
          onChange={(next) => onViewChange(next as ResultsView)}
        />
      </ControlGroup>
    </>
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
      <p className="mt-2 text-sm text-muted-foreground">Try loosening a filter or broadening the query.</p>
    </div>
  );
}
