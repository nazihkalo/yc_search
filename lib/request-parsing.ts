import { z } from "zod";

import type { SearchFilters, SearchParams } from "./search";

const sortSchema = z.enum(["relevance", "newest", "team_size", "name"]).default("relevance");

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const sort = sortSchema.parse(searchParams.get("sort") ?? "relevance");

  const filters: SearchFilters = {
    tags: parseCsv(searchParams.get("tags")),
    industries: parseCsv(searchParams.get("industries")),
    years: parseCsv(searchParams.get("years"))
      .map((year) => Number(year))
      .filter((year) => Number.isFinite(year)),
    stages: parseCsv(searchParams.get("stages")),
    regions: parseCsv(searchParams.get("regions")),
    isHiring: searchParams.get("isHiring") === "1",
    nonprofit: searchParams.get("nonprofit") === "1",
    topCompany: searchParams.get("topCompany") === "1",
  };

  return {
    query,
    page,
    pageSize,
    sort,
    filters,
  };
}
