"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  const [mode, setMode] = useState<"keyword" | "semantic">(
    (searchParams.get("mode") as "keyword" | "semantic") ?? "keyword",
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [tags, setTags] = useState<string[]>(parseCsv(searchParams.get("tags")));
  const [industries, setIndustries] = useState<string[]>(parseCsv(searchParams.get("industries")));
  const [years, setYears] = useState<number[]>(parseYears(searchParams.get("years")));
  const [regions, setRegions] = useState<string[]>(parseCsv(searchParams.get("regions")));
  const [stages, setStages] = useState<string[]>(parseCsv(searchParams.get("stages")));
  const [isHiring, setIsHiring] = useState(searchParams.get("isHiring") === "1");
  const [nonprofit, setNonprofit] = useState(searchParams.get("nonprofit") === "1");
  const [topCompany, setTopCompany] = useState(searchParams.get("topCompany") === "1");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));

  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<FacetsPayload | null>(null);
  const [results, setResults] = useState<SearchResponse>({
    total: 0,
    page: 1,
    pageSize: 20,
    results: [],
  });

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
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (tags.length) {
      params.set("tags", arrayToCsv(tags));
    }
    if (industries.length) {
      params.set("industries", arrayToCsv(industries));
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
  }, [mode, query, tags, industries, years, regions, stages, isHiring, nonprofit, topCompany, page]);

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
          <div>
            <label className="mb-1 block text-sm font-medium">Search mode</label>
            <select
              value={mode}
              onChange={(event) => {
                setPage(1);
                setMode(event.target.value as "keyword" | "semantic");
              }}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="keyword">Keyword</option>
              <option value="semantic">Semantic</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Query</label>
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder={
                mode === "semantic"
                  ? "Find B2B cybersecurity startups hiring in Europe..."
                  : "Search name, description, tags..."
              }
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isHiring}
                onChange={(event) => {
                  setPage(1);
                  setIsHiring(event.target.checked);
                }}
              />
              Hiring only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={nonprofit}
                onChange={(event) => {
                  setPage(1);
                  setNonprofit(event.target.checked);
                }}
              />
              Nonprofit only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={topCompany}
                onChange={(event) => {
                  setPage(1);
                  setTopCompany(event.target.checked);
                }}
              />
              Top companies only
            </label>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {company.url ? (
                        <a href={company.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {company.name}
                        </a>
                      ) : (
                        company.name
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">{company.one_liner ?? "No one-liner available."}</p>
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
                  {company.industry ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-1">{company.industry}</span>
                  ) : null}
                  {company.is_hiring ? <span className="rounded-full bg-emerald-100 px-2 py-1">Hiring</span> : null}
                  {company.nonprofit ? <span className="rounded-full bg-blue-100 px-2 py-1">Nonprofit</span> : null}
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-zinc-600">{company.long_description ?? ""}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  {company.tags.slice(0, 8).map((tag) => (
                    <span key={`${company.id}-${tag}`} className="rounded border border-zinc-200 px-2 py-1">
                      {tag}
                    </span>
                  ))}
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
            <label key={`${title}-${String(item.value)}`} className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2">
                <input type="checkbox" checked={checked} onChange={() => onToggle(item.value)} />
                {String(item.value)}
              </span>
              <span className="text-zinc-400">{item.count}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
