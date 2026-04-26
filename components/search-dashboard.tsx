"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  LayoutGrid,
  Network,
  Rows3,
  TableProperties,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BatchAnalyticsChart } from "./dashboard/batch-analytics-chart";
import { CompanyDetailPanel } from "./dashboard/company-detail-panel";
import { DashboardCopilotBridge } from "./dashboard/copilot-actions";
import { ResultsCardGrid } from "./dashboard/results-card-grid";
import { ResultsNikoPreviewTable } from "./dashboard/results-niko-preview-table";
import { CompaniesForceGraphTab } from "./graph/companies-force-graph-lazy";
import type {
  AnalyticsResponse,
  FacetItem,
  FacetsPayload,
  SearchResponse,
  TableColumnKey,
} from "./dashboard/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

type AnalyticsColorBy = "none" | "tags" | "industries";
type ResultsView = "cards" | "table";
type SortOption = "relevance" | "newest" | "team_size" | "name";
type DashboardTab = "results" | "analytics";

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
  const pathname = usePathname();

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
  const [graphOpen, setGraphOpen] = useState(searchParams.get("graph") === "1");
  const [graphRatio, setGraphRatio] = useState(() => {
    const raw = Number(searchParams.get("graphW"));
    return Number.isFinite(raw) && raw >= 0.2 && raw <= 0.85 ? raw : 0.5;
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() => {
    const raw = Number(searchParams.get("company"));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  });
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
    if (graphOpen) {
      params.set("graph", "1");
      if (graphRatio !== 0.5) {
        params.set("graphW", graphRatio.toFixed(2));
      }
    }
    return params.toString();
  }, [
    activeTab,
    analyticsColorBy,
    batches,
    graphOpen,
    graphRatio,
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
    () => `/dashboard?${view === "table" ? tableQueryString : baseQueryString}`,
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
    if (selectedCompanyId) {
      params.set("company", String(selectedCompanyId));
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [baseQueryString, page, pathname, router, selectedCompanyId, tablePageSize, view]);

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
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <DashboardCopilotBridge
        state={{
          query,
          tags,
          industries,
          batches,
          stages,
          regions,
          years,
          isHiring,
          nonprofit,
          topCompany,
          sort,
          view,
          activeTab,
          graphOpen,
          totalResults: results.total,
          visibleCompanies: results.results.slice(0, 30).map((row) => ({
            id: row.id,
            name: row.name,
            batch: row.batch,
            oneLiner: row.one_liner,
          })),
          facets: facets
            ? {
                tags: facets.tags,
                industries: facets.industries,
                batches: facets.batches,
                stages: facets.stages,
                regions: facets.regions,
              }
            : null,
        }}
        setters={{
          setQuery: (q) => {
            setPage(1);
            setQuery(q);
          },
          setTags: (v) => {
            setPage(1);
            setTags(v);
          },
          setIndustries: (v) => {
            setPage(1);
            setIndustries(v);
          },
          setBatches: (v) => {
            setPage(1);
            setBatches(v);
          },
          setStages: (v) => {
            setPage(1);
            setStages(v);
          },
          setRegions: (v) => {
            setPage(1);
            setRegions(v);
          },
          setYears: (v) => {
            setPage(1);
            setYears(v);
          },
          setIsHiring: (v) => {
            setPage(1);
            setIsHiring(v);
          },
          setNonprofit: (v) => {
            setPage(1);
            setNonprofit(v);
          },
          setTopCompany: (v) => {
            setPage(1);
            setTopCompany(v);
          },
          setSort: (v) => {
            setPage(1);
            setSort(v);
          },
          setView,
          setActiveTab,
          setGraphOpen,
          setSelectedCompanyId,
        }}
      />

      {selectedCompanyId !== null ? (
        <CompanyDetailPanel
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
        />
      ) : null}
      <div className={selectedCompanyId !== null ? "hidden" : "contents"}>

      <div className="space-y-6">
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

        <SplitLayout
          graphOpen={graphOpen}
          graphRatio={graphRatio}
          onGraphRatioChange={setGraphRatio}
          onCloseGraph={() => setGraphOpen(false)}
          baseQueryString={baseQueryString}
          returnToPath={returnToPath}
        >
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
                  graphOpen={graphOpen}
                  onToggleGraph={() => setGraphOpen((open) => !open)}
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
                    graphOpen={graphOpen}
                    onToggleGraph={() => setGraphOpen((open) => !open)}
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
                    graphOpen={graphOpen}
                    onToggleGraph={() => setGraphOpen((open) => !open)}
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
                      graphOpen={graphOpen}
                      onToggleGraph={() => setGraphOpen((open) => !open)}
                    />
                  }
                />
              )}
            </div>

          </section>
        )}
        </SplitLayout>
      </div>
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

const GRAPH_RATIO_PRESETS: readonly number[] = [0.3, 0.5, 0.7] as const;

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function SplitLayout({
  graphOpen,
  graphRatio,
  onGraphRatioChange,
  onCloseGraph,
  baseQueryString,
  returnToPath,
  children,
}: {
  graphOpen: boolean;
  graphRatio: number;
  onGraphRatioChange: (ratio: number) => void;
  onCloseGraph: () => void;
  baseQueryString: string;
  returnToPath: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const clampRatio = (value: number) => Math.min(0.85, Math.max(0.2, value));

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setIsDragging(true);

      const onMove = (moveEvent: PointerEvent) => {
        const relative = (moveEvent.clientX - rect.left) / rect.width;
        const nextRatio = clampRatio(1 - relative);
        onGraphRatioChange(Number(nextRatio.toFixed(3)));
      };
      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [onGraphRatioChange],
  );

  const cyclePreset = useCallback(() => {
    const current = GRAPH_RATIO_PRESETS.findIndex((preset) => Math.abs(preset - graphRatio) < 0.02);
    const nextIndex = (current + 1) % GRAPH_RATIO_PRESETS.length;
    onGraphRatioChange(GRAPH_RATIO_PRESETS[nextIndex]);
  }, [graphRatio, onGraphRatioChange]);

  if (!graphOpen) {
    return <>{children}</>;
  }

  if (!isDesktop) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-primary" />
              <p className="text-sm font-semibold">Companies graph</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onCloseGraph}
            >
              <X className="size-3.5" />
              Close
            </Button>
          </div>
          <div className="relative flex-1">
            <CompaniesForceGraphTab
              baseQueryString={baseQueryString}
              returnToPath={returnToPath}
            />
          </div>
        </div>
      </>
    );
  }

  const leftPercent = Math.round((1 - graphRatio) * 1000) / 10;
  const rightPercent = Math.round(graphRatio * 1000) / 10;

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid gap-0",
        isDragging && "select-none",
      )}
      style={{
        gridTemplateColumns: `${leftPercent}% 6px ${rightPercent}%`,
        minHeight: "720px",
      }}
    >
      <div className="min-w-0 pr-2">{children}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(rightPercent)}
        onPointerDown={startDrag}
        onDoubleClick={() => onGraphRatioChange(0.5)}
        className={cn(
          "group relative flex cursor-col-resize items-center justify-center",
          "before:absolute before:inset-y-0 before:left-1/2 before:-ml-[1px] before:w-[2px] before:bg-border/60 before:transition-colors",
          "hover:before:bg-primary/40",
          isDragging && "before:bg-primary/70",
        )}
      >
        <span className="relative z-10 flex h-10 w-[6px] flex-col items-center justify-center gap-1">
          <span className="size-1 rounded-full bg-muted-foreground/60 transition-colors group-hover:bg-primary" />
          <span className="size-1 rounded-full bg-muted-foreground/60 transition-colors group-hover:bg-primary" />
          <span className="size-1 rounded-full bg-muted-foreground/60 transition-colors group-hover:bg-primary" />
        </span>
      </div>

      <div className="sticky top-4 min-w-0 self-start">
        <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-primary" />
              <p className="text-xs font-semibold tracking-tight">Companies graph</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cyclePreset}
                title="Cycle width: 30 / 50 / 70%"
                className="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                {Math.round(rightPercent)}%
              </button>
              <button
                type="button"
                onClick={onCloseGraph}
                className="flex size-7 items-center justify-center rounded-full border border-border/50 bg-background/70 text-muted-foreground transition hover:text-foreground"
                aria-label="Close graph"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="relative flex-1">
            <CompaniesForceGraphTab
              baseQueryString={baseQueryString}
              returnToPath={returnToPath}
            />
          </div>
        </div>
      </div>
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
  graphOpen,
  onToggleGraph,
}: {
  activeTab: DashboardTab;
  onActiveTabChange: (next: DashboardTab) => void;
  sort: SortOption;
  onSortChange: (next: SortOption) => void;
  view: ResultsView;
  onViewChange: (next: ResultsView) => void;
  graphOpen: boolean;
  onToggleGraph: () => void;
}) {
  return (
    <>
      <ControlGroup label="Browse">
        <SegmentedControl
          compact
          options={[
            { value: "results", label: "Results", icon: <Rows3 className="size-3.5" /> },
            { value: "analytics", label: "Analytics", icon: <BarChart3 className="size-3.5" /> },
          ]}
          value={activeTab}
          onChange={(next) => onActiveTabChange(next as DashboardTab)}
        />
      </ControlGroup>

      <ControlGroup label="Companion">
        <Button
          type="button"
          variant={graphOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleGraph}
          className="rounded-full"
        >
          <Network className="size-3.5" />
          {graphOpen ? "Hide graph" : "Show graph"}
        </Button>
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
