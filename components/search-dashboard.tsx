"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Brain,
  LayoutGrid,
  Layers3,
  ListFilter,
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
  TableColumnKey,
} from "./dashboard/types";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { cn } from "../lib/utils";

type AnalyticsColorBy = "none" | "tags" | "industries";
type ResultsView = "cards" | "table";
type SortOption = "relevance" | "newest" | "team_size" | "name";
type DashboardTab = "results" | "analytics";
type CohortGranularity = "year" | "batch";

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

function parseBatchYear(batch: string) {
  const compactBatchMatch = batch.match(/^([WSF])(\d{2})$/i);
  if (compactBatchMatch) {
    return 2000 + Number(compactBatchMatch[2]);
  }

  const namedBatchMatch = batch.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (namedBatchMatch) {
    return Number(namedBatchMatch[2]);
  }

  return null;
}

function groupBatchFacets(items: FacetItem<string>[]) {
  const grouped = new Map<number | null, FacetItem<string>[]>();

  for (const item of items) {
    const year = parseBatchYear(item.value);
    grouped.set(year, [...(grouped.get(year) ?? []), item]);
  }

  return [...grouped.entries()]
    .sort((left, right) => {
      const leftYear = left[0] ?? Number.NEGATIVE_INFINITY;
      const rightYear = right[0] ?? Number.NEGATIVE_INFINITY;
      return rightYear - leftYear;
    })
    .map(([year, batches]) => ({
      year,
      label: year ? String(year) : "Other",
      batches,
    }));
}

export function SearchDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<DashboardTab>((searchParams.get("tab") as DashboardTab) ?? "results");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>((searchParams.get("sort") as SortOption) ?? "relevance");
  const [view, setView] = useState<ResultsView>((searchParams.get("view") as ResultsView) ?? "table");
  const [cohortGranularity, setCohortGranularity] = useState<CohortGranularity>(
    searchParams.get("cohort") === "batch" ? "batch" : "year",
  );
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
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
  const [loadingMoreCards, setLoadingMoreCards] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (view !== "table") {
      setShowColumnPicker(false);
    }
  }, [view]);

  const baseQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    params.set("sort", sort);
    params.set("view", view);
    params.set("colorBy", analyticsColorBy);
    params.set("cohort", cohortGranularity);
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
    cohortGranularity,
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

    fetch(`/api/search?${queryString}`)
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

  function toggleTableColumn(column: TableColumnKey) {
    setVisibleTableColumns((current) => {
      if (current.includes(column)) {
        return current.filter((item) => item !== column);
      }

      const next = [...current, column];
      return ALL_TABLE_COLUMNS.map((item) => item.key).filter((key) => next.includes(key));
    });
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

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,320px)_minmax(0,1fr)_auto] xl:items-start">
                <ControlGroup label="Browse">
                  <SegmentedControl
                    compact
                    fullWidth
                    options={[
                      { value: "results", label: "Results" },
                      { value: "analytics", label: "Analytics" },
                    ]}
                    value={activeTab}
                    onChange={(next) => setActiveTab(next as DashboardTab)}
                  />
                </ControlGroup>

                <ControlGroup label="Sort">
                  <SegmentedControl
                    compact
                    fullWidth
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
                </ControlGroup>

                <ControlGroup label="Quick filters">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <CompactToggle
                      label="Hiring"
                      checked={isHiring}
                      onCheckedChange={(checked) => {
                        setPage(1);
                        setIsHiring(checked);
                      }}
                      className="w-full sm:w-auto"
                    />
                    <CompactToggle
                      label="Nonprofit"
                      checked={nonprofit}
                      onCheckedChange={(checked) => {
                        setPage(1);
                        setNonprofit(checked);
                      }}
                      className="w-full sm:w-auto"
                    />
                    <CompactToggle
                      label="Top"
                      checked={topCompany}
                      onCheckedChange={(checked) => {
                        setPage(1);
                        setTopCompany(checked);
                      }}
                      className="w-full sm:w-auto"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvancedFilters((current) => !current)}
                      className="w-full rounded-full sm:w-auto"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      More filters
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetAllFilters}
                      className="w-full rounded-full sm:w-auto"
                    >
                      <RefreshCcw className="size-3.5" />
                      Reset
                    </Button>
                  </div>
                </ControlGroup>

                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-2 text-xs font-medium text-primary xl:mt-6 xl:self-start">
                  <Layers3 className="size-3.5" />
                  Hybrid search
                </div>
              </div>

              <CohortFilterPanel
                granularity={cohortGranularity}
                onGranularityChange={(next) => setCohortGranularity(next)}
                years={pickTopFacets(facets?.years ?? [], 18)}
                batches={pickTopFacets(facets?.batches ?? [], 40)}
                selectedYears={years}
                selectedBatches={batches}
                loading={facetsLoading}
                onToggleYear={(value) => {
                  setPage(1);
                  toggleArrayValue(value, years, setYears);
                }}
                onToggleBatch={(value) => {
                  setPage(1);
                  toggleArrayValue(value, batches, setBatches);
                }}
              />
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
              <CardContent className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-4">
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
                  {view === "cards"
                    ? `${results.results.length.toLocaleString()} loaded`
                    : `Hybrid search, page ${results.page} of ${totalPages}`}
                </p>
              </div>
              {view === "table" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnPicker((current) => !current)}
                    className="rounded-full"
                  >
                    <ListFilter className="size-3.5" />
                    Columns
                  </Button>
                  <PaginationControls
                    page={page}
                    total={results.total}
                    pageSize={results.pageSize}
                    pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
                    onPrev={() => setPage((previous) => Math.max(1, previous - 1))}
                    onNext={() => setPage((previous) => previous + 1)}
                    onPageSizeChange={(nextSize) => {
                      setPage(1);
                      setTablePageSize(nextSize);
                    }}
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {results.results.length < results.total ? "Scroll to load more" : "All matching cards loaded"}
                </div>
              )}
            </div>

            {view === "table" && showColumnPicker ? (
              <ColumnPicker
                columns={ALL_TABLE_COLUMNS}
                selectedColumns={visibleTableColumns}
                onToggleColumn={toggleTableColumn}
              />
            ) : null}

            {error ? <ErrorBanner message={error} /> : null}

            {resultsLoading ? (
              <LoadingState label="Refreshing results..." />
            ) : results.results.length === 0 ? (
              <EmptyState />
            ) : view === "cards" ? (
              <>
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
              <ResultsTable
                results={results.results}
                returnToPath={returnToPath}
                selectedTags={tags}
                selectedIndustries={industries}
                sort={sort}
                visibleColumns={visibleTableColumns}
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
                {view === "table" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowColumnPicker((current) => !current)}
                      className="rounded-full"
                    >
                      <ListFilter className="size-3.5" />
                      Columns
                    </Button>
                    <PaginationControls
                      page={page}
                      total={results.total}
                      pageSize={results.pageSize}
                      pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
                      onPrev={() => setPage((previous) => Math.max(1, previous - 1))}
                      onNext={() => setPage((previous) => previous + 1)}
                      onPageSizeChange={(nextSize) => {
                        setPage(1);
                        setTablePageSize(nextSize);
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {results.results.length.toLocaleString()} of {results.total.toLocaleString()} loaded
                  </div>
                )}
              </div>

              {view === "table" && showColumnPicker ? (
                <ColumnPicker
                  columns={ALL_TABLE_COLUMNS}
                  selectedColumns={visibleTableColumns}
                  onToggleColumn={toggleTableColumn}
                />
              ) : null}

              {resultsLoading ? (
                <LoadingState label="Refreshing results..." />
              ) : view === "cards" ? (
                <>
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
                <ResultsTable
                  results={results.results}
                  returnToPath={returnToPath}
                  selectedTags={tags}
                  selectedIndustries={industries}
                  sort={sort}
                  visibleColumns={visibleTableColumns}
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

function CompactToggle({
  label,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-full border border-border/70 bg-background/70 px-3 py-2",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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

function PaginationControls({
  page,
  total,
  pageSize,
  pageSizeOptions,
  onPrev,
  onNext,
  onPageSizeChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-background/70 p-1">
      <label className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground">
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="bg-transparent text-foreground outline-none"
        >
          {pageSizeOptions.map((option) => (
            <option key={`page-size-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
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

function ColumnPicker({
  columns,
  selectedColumns,
  onToggleColumn,
}: {
  columns: Array<{ key: TableColumnKey; label: string }>;
  selectedColumns: TableColumnKey[];
  onToggleColumn: (column: TableColumnKey) => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Customize table columns</p>
          <p className="text-xs text-muted-foreground">
            Company stays pinned. Toggle whichever metadata columns you want in the table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => {
            const selected = selectedColumns.includes(column.key);
            return (
              <button
                key={`column-${column.key}`}
                type="button"
                onClick={() => onToggleColumn(column.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  selected
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {column.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
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

function CohortFilterPanel({
  granularity,
  onGranularityChange,
  years,
  batches,
  selectedYears,
  selectedBatches,
  loading,
  onToggleYear,
  onToggleBatch,
}: {
  granularity: CohortGranularity;
  onGranularityChange: (value: CohortGranularity) => void;
  years: FacetItem<number>[];
  batches: FacetItem<string>[];
  selectedYears: number[];
  selectedBatches: string[];
  loading: boolean;
  onToggleYear: (value: number) => void;
  onToggleBatch: (value: string) => void;
}) {
  const groupedBatches = useMemo(() => groupBatchFacets(batches), [batches]);
  const visibleBatchGroups = selectedYears.length
    ? groupedBatches.filter((group) => group.year !== null && selectedYears.includes(group.year))
    : groupedBatches.slice(0, 6);

  return (
    <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Cohort</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {granularity === "year"
              ? "Broader filtering by launch year."
              : "Pick a year, then optionally narrow to a specific batch."}
          </p>
        </div>
        <SegmentedControl
          compact
          options={[
            { value: "year", label: "Year" },
            { value: "batch", label: "Batch" },
          ]}
          value={granularity}
          onChange={(value) => onGranularityChange(value as CohortGranularity)}
        />
      </div>

      {loading ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-xs text-muted-foreground">
          Loading cohort filters...
        </div>
      ) : granularity === "year" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {years.map((item) => {
            const selected = selectedYears.includes(item.value);
            return (
              <button
                key={`cohort-year-${item.value}`}
                type="button"
                onClick={() => onToggleYear(item.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  selected
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground",
                )}
              >
                {item.value}
                <span className="ml-2 text-[11px] opacity-70">{item.count}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {years.map((item) => {
              const selected = selectedYears.includes(item.value);
              return (
                <button
                  key={`batch-year-${item.value}`}
                  type="button"
                  onClick={() => onToggleYear(item.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    selected
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.value}
                  <span className="ml-2 text-[11px] opacity-70">{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleBatchGroups.length > 0 ? (
              visibleBatchGroups.map((group) => (
                <section key={`batch-group-${group.label}`} className="rounded-2xl border border-border/70 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{group.label}</h3>
                    <span className="text-[11px] text-muted-foreground">{group.batches.length} batches</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.batches.map((item) => {
                      const selected = selectedBatches.includes(item.value);
                      return (
                        <button
                          key={`cohort-batch-${item.value}`}
                          type="button"
                          onClick={() => onToggleBatch(item.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition",
                            selected
                              ? "border-primary/40 bg-primary/12 text-primary"
                              : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {item.value}
                          <span className="ml-2 text-[11px] opacity-70">{item.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-xs text-muted-foreground">
                Select a year above to narrow batch choices.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
