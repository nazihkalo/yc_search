import type { CompanyLink } from "../../lib/company-links";

export type FacetItem<T extends string | number = string> = {
  value: T;
  count: number;
};

export type FacetsPayload = {
  tags: FacetItem<string>[];
  industries: FacetItem<string>[];
  batches: FacetItem<string>[];
  regions: FacetItem<string>[];
  stages: FacetItem<string>[];
  years: FacetItem<number>[];
};

export type CompanyResult = {
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
  top_links: CompanyLink[];
};

export type SearchResponse = {
  total: number;
  page: number;
  pageSize: number;
  results: CompanyResult[];
};

export type TableColumnKey =
  | "score"
  | "industries"
  | "tags"
  | "batch"
  | "stage"
  | "team_size"
  | "status"
  | "links"
  | "location"
  | "launched_year";

export type AnalyticsResponse = {
  colorBy: "none" | "tags" | "industries";
  totalCompanies: number;
  series: string[];
  rows: Array<Record<string, string | number | null>>;
};

export type ChatCitation = {
  id: number;
  name: string;
  companyPage: string;
  whyRelevant: string;
  urls: string[];
};

export type ChatResponse = {
  answer: string;
  citations: ChatCitation[];
};
