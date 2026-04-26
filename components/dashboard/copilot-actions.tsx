"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useCopilotAction,
  useCopilotAdditionalInstructions,
  useCopilotReadable,
} from "@copilotkit/react-core";
import {
  CompanyDetailChatCard,
  CompanyResultsList,
  FoundersShowcase,
  ToolCallTrace,
  type CompanyChatCardData,
  type CompanyDetailChatData,
  type FounderShowcaseFounder,
} from "./chat-cards";
import { Badge } from "../ui/badge";

type SortOption = "relevance" | "newest" | "team_size" | "name";
type ResultsView = "cards" | "table";
type DashboardTab = "results" | "analytics";

export type VisibleCompany = {
  id: number;
  name: string;
  batch: string | null;
  oneLiner: string | null;
};

export type FacetCounts = {
  tags?: Array<{ value: string; count: number }>;
  industries?: Array<{ value: string; count: number }>;
  batches?: Array<{ value: string; count: number }>;
  stages?: Array<{ value: string; count: number }>;
  regions?: Array<{ value: string; count: number }>;
};

export type DashboardBridgeState = {
  query: string;
  tags: string[];
  industries: string[];
  batches: string[];
  stages: string[];
  regions: string[];
  years: number[];
  isHiring: boolean;
  nonprofit: boolean;
  topCompany: boolean;
  sort: SortOption;
  view: ResultsView;
  activeTab: DashboardTab;
  graphOpen: boolean;
  totalResults: number;
  visibleCompanies: VisibleCompany[];
  facets: FacetCounts | null;
};

export type DashboardBridgeSetters = {
  setQuery: (q: string) => void;
  setTags: (v: string[]) => void;
  setIndustries: (v: string[]) => void;
  setBatches: (v: string[]) => void;
  setStages: (v: string[]) => void;
  setRegions: (v: string[]) => void;
  setYears: (v: number[]) => void;
  setIsHiring: (v: boolean) => void;
  setNonprofit: (v: boolean) => void;
  setTopCompany: (v: boolean) => void;
  setSort: (v: SortOption) => void;
  setView: (v: ResultsView) => void;
  setActiveTab: (v: DashboardTab) => void;
  setGraphOpen: (v: boolean) => void;
  setSelectedCompanyId: (v: number | null) => void;
  setHighlightCompanyId: (v: number | null) => void;
};

type Props = {
  state: DashboardBridgeState;
  setters: DashboardBridgeSetters;
};

export function DashboardCopilotBridge({ state, setters }: Props) {
  // Refs let the action handlers stay STABLE across renders (registered once
  // with empty deps) while still reading the latest state and setters.
  // Without this, useCopilotAction re-registers on every render — and the
  // re-registration races in-flight tool calls, producing
  // "Tool result is missing for tool call ...".
  const stateRef = useRef(state);
  const settersRef = useRef(setters);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    settersRef.current = setters;
  }, [setters]);

  // Listen for "show in graph" events dispatched from chat cards.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onShowInGraph = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: number; companyName?: string }>).detail;
      const set = settersRef.current;
      if (detail?.companyName) {
        set.setQuery(detail.companyName);
      }
      set.setSelectedCompanyId(null);
      set.setGraphOpen(true);
      set.setHighlightCompanyId(detail?.companyId ?? null);
    };
    const onOpenCompany = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: number }>).detail;
      const id = detail?.companyId;
      if (typeof id === "number") {
        settersRef.current.setSelectedCompanyId(id);
        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("yc-show-in-graph", onShowInGraph as EventListener);
    window.addEventListener("yc-open-company", onOpenCompany as EventListener);
    return () => {
      window.removeEventListener("yc-show-in-graph", onShowInGraph as EventListener);
      window.removeEventListener("yc-open-company", onOpenCompany as EventListener);
    };
  }, []);

  const facetInstructions = useMemo(
    () => buildFacetInstructions(state.facets),
    [state.facets],
  );

  useCopilotAdditionalInstructions(
    {
      instructions: facetInstructions,
      available: facetInstructions ? "enabled" : "disabled",
    },
    [facetInstructions],
  );

  useCopilotReadable({
    description:
      "Current YC search dashboard state — the query, active filters, sort, view, and total result count. " +
      "Use this to understand what's already on the user's screen before calling tools.",
    value: {
      query: state.query,
      filters: {
        tags: state.tags,
        industries: state.industries,
        batches: state.batches,
        stages: state.stages,
        regions: state.regions,
        years: state.years,
        isHiring: state.isHiring,
        nonprofit: state.nonprofit,
        topCompany: state.topCompany,
      },
      sort: state.sort,
      view: state.view,
      activeTab: state.activeTab,
      totalResults: state.totalResults,
    },
  });

  useCopilotReadable({
    description:
      "First page of companies visible in the table on the user's left, with id, name, batch, and one-liner. " +
      "When the user says 'the third one' or 'tell me about the second', resolve against this list.",
    value: state.visibleCompanies,
  });

  useCopilotReadable({
    description:
      "Available filter values (top facets by company count). When applying filters via " +
      "searchCompanies, prefer exact matches against these lists. If the user's request doesn't " +
      "match any facet (e.g. 'sleep tech', 'agentic accounting'), pass it as the free-text query " +
      "instead — the search runs hybrid keyword + semantic over the whole index.",
    value: pickFacetSnapshot(state.facets),
  });

  useCopilotAction(
    {
      name: "searchCompanies",
      description:
        "Apply a search query and/or filters to the YC companies table on the user's left. " +
        "Pass only the fields you want to change. Existing filters are merged unless `replaceFilters` is true. " +
        "Use the user's current state (visible via the readable) to decide whether to add or replace.",
      parameters: [
        {
          name: "query",
          type: "string",
          description:
            "Free-text search query. Pass empty string to clear the query without touching filters.",
          required: false,
        },
        {
          name: "tags",
          type: "string[]",
          description:
            "Tag filters (e.g. 'AI', 'Developer Tools'). Match exact YC tag values when possible.",
          required: false,
        },
        {
          name: "industries",
          type: "string[]",
          description: "Industry filters (e.g. 'Fintech', 'Healthcare').",
          required: false,
        },
        {
          name: "batches",
          type: "string[]",
          description:
            "YC batch identifiers (e.g. 'S24', 'W23', 'Spring 2026'). Use the format that appears in the data.",
          required: false,
        },
        {
          name: "stages",
          type: "string[]",
          description: "Stage filters (e.g. 'Seed', 'Series A').",
          required: false,
        },
        {
          name: "regions",
          type: "string[]",
          description: "Region filters (e.g. 'United States', 'Europe').",
          required: false,
        },
        {
          name: "years",
          type: "number[]",
          description: "Launch-year filters.",
          required: false,
        },
        {
          name: "isHiring",
          type: "boolean",
          description: "Filter to companies currently hiring.",
          required: false,
        },
        {
          name: "nonprofit",
          type: "boolean",
          description: "Filter to nonprofit companies.",
          required: false,
        },
        {
          name: "topCompany",
          type: "boolean",
          description: "Filter to YC top companies.",
          required: false,
        },
        {
          name: "sort",
          type: "string",
          description: "Sort order: 'relevance' | 'newest' | 'team_size' | 'name'.",
          required: false,
        },
        {
          name: "replaceFilters",
          type: "boolean",
          description:
            "If true, replace all filters (set unspecified ones to empty/false). Default: merge with existing filters.",
          required: false,
        },
      ],
      handler: async (args) => {
        try {
          const {
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
            replaceFilters,
          } = args as {
            query?: string;
            tags?: string[];
            industries?: string[];
            batches?: string[];
            stages?: string[];
            regions?: string[];
            years?: number[];
            isHiring?: boolean;
            nonprofit?: boolean;
            topCompany?: boolean;
            sort?: string;
            replaceFilters?: boolean;
          };

          const s = stateRef.current;
          const set = settersRef.current;
          const replace = replaceFilters === true;

          set.setHighlightCompanyId(null);
          if (query !== undefined) set.setQuery(query);
          if (tags !== undefined) {
            set.setTags(replace ? tags : Array.from(new Set([...s.tags, ...tags])));
          } else if (replace) set.setTags([]);
          if (industries !== undefined) {
            set.setIndustries(
              replace ? industries : Array.from(new Set([...s.industries, ...industries])),
            );
          } else if (replace) set.setIndustries([]);
          if (batches !== undefined) {
            set.setBatches(replace ? batches : Array.from(new Set([...s.batches, ...batches])));
          } else if (replace) set.setBatches([]);
          if (stages !== undefined) {
            set.setStages(replace ? stages : Array.from(new Set([...s.stages, ...stages])));
          } else if (replace) set.setStages([]);
          if (regions !== undefined) {
            set.setRegions(replace ? regions : Array.from(new Set([...s.regions, ...regions])));
          } else if (replace) set.setRegions([]);
          if (years !== undefined) {
            set.setYears(replace ? years : Array.from(new Set([...s.years, ...years])));
          } else if (replace) set.setYears([]);
          if (isHiring !== undefined) set.setIsHiring(isHiring);
          else if (replace) set.setIsHiring(false);
          if (nonprofit !== undefined) set.setNonprofit(nonprofit);
          else if (replace) set.setNonprofit(false);
          if (topCompany !== undefined) set.setTopCompany(topCompany);
          else if (replace) set.setTopCompany(false);
          if (sort !== undefined && isSortOption(sort)) set.setSort(sort);

          return "Filters applied.";
        } catch (error) {
          return `Failed to apply filters: ${
            error instanceof Error ? error.message : "unknown error"
          }`;
        }
      },
      render: ({ status, args }) => {
        const a = (args ?? {}) as Record<string, unknown>;
        const chips: Array<{ label: string; tone?: "primary" | "muted" }> = [];
        const queryStr = typeof a.query === "string" ? a.query : "";
        if (queryStr) chips.push({ label: `query: ${queryStr}`, tone: "primary" });
        const filterFields: Array<keyof typeof a> = [
          "tags",
          "industries",
          "batches",
          "stages",
          "regions",
          "years",
        ];
        for (const key of filterFields) {
          const v = a[key];
          if (Array.isArray(v) && v.length > 0) {
            chips.push({ label: `${String(key)}: ${v.join(", ")}` });
          }
        }
        for (const flag of ["isHiring", "nonprofit", "topCompany"] as const) {
          if (a[flag] === true) chips.push({ label: flag });
        }
        if (typeof a.sort === "string" && a.sort !== "relevance") {
          chips.push({ label: `sort: ${a.sort}` });
        }
        const summary = chips.length > 0 ? `${chips.length} chip${chips.length === 1 ? "" : "s"}` : "no-op";
        return (
          <div className="my-1 flex flex-col gap-1">
            <ToolCallTrace
              name="searchCompanies"
              status={status}
              args={a}
              summary={status === "complete" ? `applied · ${summary}` : "applying…"}
            />
            {chips.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {chips.map((chip) => (
                  <Badge
                    key={chip.label}
                    variant={chip.tone === "primary" ? "default" : "muted"}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {chip.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
    },
    [],
  );

  useCopilotAction(
    {
      name: "clearFilters",
      description:
        "Clear all filters and the search query. Use when the user asks to start fresh or reset.",
      parameters: [],
      handler: async () => {
        try {
          const set = settersRef.current;
          set.setQuery("");
          set.setTags([]);
          set.setIndustries([]);
          set.setBatches([]);
          set.setStages([]);
          set.setRegions([]);
          set.setYears([]);
          set.setIsHiring(false);
          set.setNonprofit(false);
          set.setTopCompany(false);
          return "Filters cleared.";
        } catch (error) {
          return `Failed to clear filters: ${
            error instanceof Error ? error.message : "unknown error"
          }`;
        }
      },
      render: ({ status }) => (
        <ToolCallTrace
          name="clearFilters"
          status={status}
          args={{}}
          summary={status === "complete" ? "filters reset" : "clearing…"}
        />
      ),
    },
    [],
  );

  useCopilotAction(
    {
      name: "switchView",
      description:
        "Change the left-pane view. 'table' / 'cards' show results in different layouts. " +
        "'analytics' switches to the batch-analytics chart. " +
        "'graph' opens the 3D force graph — use this for any visual/spatial/relational request.",
      parameters: [
        {
          name: "view",
          type: "string",
          description: "'table' | 'cards' | 'analytics' | 'graph'",
          required: true,
        },
      ],
      handler: async (args) => {
        try {
          const { view } = args as { view: string };
          const set = settersRef.current;
          if (view === "table" || view === "cards") {
            set.setActiveTab("results");
            set.setView(view);
            return `Switched to ${view} view.`;
          }
          if (view === "analytics") {
            set.setActiveTab("analytics");
            return "Switched to analytics.";
          }
          if (view === "graph") {
            set.setActiveTab("results");
            set.setGraphOpen(true);
            return "Opened graph view.";
          }
          return `Unknown view: ${view}.`;
        } catch (error) {
          return `Failed to switch view: ${
            error instanceof Error ? error.message : "unknown error"
          }`;
        }
      },
      render: ({ status, args }) => (
        <ToolCallTrace
          name="switchView"
          status={status}
          args={(args ?? {}) as Record<string, unknown>}
          summary={status === "complete" ? "view switched" : "switching…"}
        />
      ),
    },
    [],
  );

  useCopilotAction(
    {
      name: "openCompanyDetail",
      description:
        "Open the detail page for a YC company, identified by its numeric id. The user is navigated " +
        "to a new page with the full company record, founders, and similar companies graph.",
      parameters: [
        {
          name: "companyId",
          type: "number",
          description: "Numeric id of the company (visible in the visibleCompanies readable).",
          required: true,
        },
      ],
      handler: async (args) => {
        try {
          const { companyId } = args as { companyId: number };
          settersRef.current.setSelectedCompanyId(companyId);
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          return `Opened company ${companyId} in the left pane.`;
        } catch (error) {
          return `Failed to open company: ${
            error instanceof Error ? error.message : "unknown error"
          }`;
        }
      },
      render: ({ status, args }) => (
        <ToolCallTrace
          name="openCompanyDetail"
          status={status}
          args={(args ?? {}) as Record<string, unknown>}
          summary={status === "complete" ? "opened in left pane" : "opening…"}
        />
      ),
    },
    [],
  );

  useCopilotAction(
    {
      name: "askKnowledgeBase",
      description:
        "Retrieve a few of the most relevant YC companies for a natural-language query, with " +
        "snippets from their website + YC profile content. Use this to ground your answers in " +
        "real data when the user asks a factual question (e.g. 'who's building X?', 'has anyone " +
        "tried Y?'). Returns up to 10 results — pick the best 2-4 to cite.",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "The natural-language question or topic to search for.",
          required: true,
        },
        {
          name: "topK",
          type: "number",
          description: "How many candidates to retrieve (default 6, max 10).",
          required: false,
        },
        {
          name: "tags",
          type: "string[]",
          description: "Optional tag filters.",
          required: false,
        },
        {
          name: "industries",
          type: "string[]",
          description: "Optional industry filters.",
          required: false,
        },
        {
          name: "batches",
          type: "string[]",
          description: "Optional batch filters.",
          required: false,
        },
        {
          name: "stages",
          type: "string[]",
          description: "Optional stage filters.",
          required: false,
        },
        {
          name: "regions",
          type: "string[]",
          description: "Optional region filters.",
          required: false,
        },
      ],
      handler: async (args) => {
        try {
          const { query, topK, tags, industries, batches, stages, regions } = args as {
            query: string;
            topK?: number;
            tags?: string[];
            industries?: string[];
            batches?: string[];
            stages?: string[];
            regions?: string[];
          };
          const res = await fetch("/api/chat-tools/ask-knowledge-base", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              topK,
              filters: { tags, industries, batches, stages, regions },
            }),
          });
          if (!res.ok) {
            return JSON.stringify({
              error: `askKnowledgeBase failed (${res.status})`,
            });
          }
          const payload = await res.json();
          return JSON.stringify(payload);
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
      render: ({ status, args, result }) => {
        const argRecord = (args ?? {}) as Record<string, unknown>;
        const trace = (
          <ToolCallTrace
            name="askKnowledgeBase"
            status={status}
            args={argRecord}
            summary={
              status === "complete"
                ? (() => {
                    const parsed = parseToolResult<{ results?: unknown[] }>(result);
                    const n = parsed?.results?.length ?? 0;
                    return `${n} result${n === 1 ? "" : "s"}`;
                  })()
                : "searching…"
            }
          />
        );
        if (status !== "complete") {
          const q = typeof argRecord.query === "string" ? argRecord.query : "";
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-dashed border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Searching the knowledge base{q ? <> for &ldquo;{q}&rdquo;</> : null}…
              </div>
            </div>
          );
        }
        const parsed = parseToolResult<{
          query?: string;
          totalCandidates?: number;
          results?: CompanyChatCardData[];
          error?: string;
        }>(result);
        if (!parsed || parsed.error) {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {parsed?.error ?? "Knowledge base lookup failed."}
              </div>
            </div>
          );
        }
        return (
          <div className="my-2 flex flex-col">
            {trace}
            <CompanyResultsList
              query={parsed.query ?? (typeof argRecord.query === "string" ? argRecord.query : "")}
              totalCandidates={parsed.totalCandidates ?? 0}
              results={parsed.results ?? []}
            />
          </div>
        );
      },
    },
    [],
  );

  useCopilotAction(
    {
      name: "lookupCompany",
      description:
        "Fetch full details for a single YC company by numeric id or slug — use this when the " +
        "user asks about one specific company. Returns founders, links, batch, stage, industry, " +
        "and the long description.",
      parameters: [
        {
          name: "idOrSlug",
          type: "string",
          description:
            "The company's numeric id (e.g. '31417') or slug (e.g. 'pairio'). Strings are " +
            "matched case-insensitively against slug.",
          required: true,
        },
      ],
      handler: async (args) => {
        try {
          const { idOrSlug } = args as { idOrSlug: string };
          const res = await fetch("/api/chat-tools/lookup-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idOrSlug }),
          });
          if (!res.ok) {
            return JSON.stringify({ error: `lookupCompany failed (${res.status})` });
          }
          const payload = await res.json();
          return JSON.stringify(payload);
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
      render: ({ status, args, result }) => {
        const argRecord = (args ?? {}) as Record<string, unknown>;
        const id = typeof argRecord.idOrSlug === "string" ? argRecord.idOrSlug : "";
        const trace = (
          <ToolCallTrace
            name="lookupCompany"
            status={status}
            args={argRecord}
            summary={status === "complete" ? `fetched ${id || "company"}` : "looking up…"}
          />
        );
        if (status !== "complete") {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-dashed border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Looking up {id || "company"}…
              </div>
            </div>
          );
        }
        const parsed = parseToolResult<
          | (CompanyDetailChatData & { found: true })
          | { found: false; message?: string }
          | { error: string }
        >(result);
        if (!parsed) {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Lookup failed.
              </div>
            </div>
          );
        }
        if ("error" in parsed) {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {parsed.error}
              </div>
            </div>
          );
        }
        if (parsed.found === false) {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-dashed border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                {parsed.message ?? "No matching YC company."}
              </div>
            </div>
          );
        }
        return (
          <div className="my-2 flex flex-col">
            {trace}
            <CompanyDetailChatCard company={parsed} />
          </div>
        );
      },
    },
    [],
  );

  useCopilotAction(
    {
      name: "findFounders",
      description:
        "Find founders across YC companies that match a topic or area. Returns a flat list of " +
        "founders (avatar, title, bio, social links) WITH their company tag attached. Use this when " +
        "the user asks about founders/people in a space (e.g. 'founders building robotics', 'who " +
        "leads the AI tutoring companies'). The chat UI renders dedicated founder profile cards — do " +
        "not re-list founders or companies in your prose; just frame the insight.",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "Topic to search for (e.g. 'robotics', 'AI agents for legal').",
          required: true,
        },
        {
          name: "topK",
          type: "number",
          description: "How many companies to draw founders from (default 6, max 10).",
          required: false,
        },
        {
          name: "tags",
          type: "string[]",
          description: "Optional tag filters.",
          required: false,
        },
        {
          name: "industries",
          type: "string[]",
          description: "Optional industry filters.",
          required: false,
        },
        {
          name: "batches",
          type: "string[]",
          description:
            "Optional batch filters. ONLY pass when user names a specific batch like 'S24'.",
          required: false,
        },
      ],
      handler: async (args) => {
        try {
          const { query, topK, tags, industries, batches } = args as {
            query: string;
            topK?: number;
            tags?: string[];
            industries?: string[];
            batches?: string[];
          };
          const res = await fetch("/api/chat-tools/find-founders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, topK, filters: { tags, industries, batches } }),
          });
          if (!res.ok) {
            return JSON.stringify({ error: `findFounders failed (${res.status})` });
          }
          const payload = await res.json();
          return JSON.stringify(payload);
        } catch (error) {
          return JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
      render: ({ status, args, result }) => {
        const argRecord = (args ?? {}) as Record<string, unknown>;
        const trace = (
          <ToolCallTrace
            name="findFounders"
            status={status}
            args={argRecord}
            summary={
              status === "complete"
                ? (() => {
                    const parsed = parseToolResult<{ founders?: unknown[] }>(result);
                    const n = parsed?.founders?.length ?? 0;
                    return `${n} founder${n === 1 ? "" : "s"}`;
                  })()
                : "searching…"
            }
          />
        );
        if (status !== "complete") {
          const q = typeof argRecord.query === "string" ? argRecord.query : "";
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-dashed border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Searching for founders{q ? <> in &ldquo;{q}&rdquo;</> : null}…
              </div>
            </div>
          );
        }
        const parsed = parseToolResult<{
          query?: string;
          totalCompanies?: number;
          founders?: FounderShowcaseFounder[];
          error?: string;
        }>(result);
        if (!parsed || parsed.error) {
          return (
            <div className="my-2 flex flex-col">
              {trace}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {parsed?.error ?? "Founder lookup failed."}
              </div>
            </div>
          );
        }
        return (
          <div className="my-2 flex flex-col">
            {trace}
            <FoundersShowcase
              query={parsed.query ?? (typeof argRecord.query === "string" ? argRecord.query : "")}
              totalCompanies={parsed.totalCompanies ?? 0}
              founders={parsed.founders ?? []}
            />
          </div>
        );
      },
    },
    [],
  );

  return null;
}

function parseToolResult<T>(result: unknown): T | null {
  if (result == null) return null;
  if (typeof result === "object") return result as T;
  if (typeof result !== "string") return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

function isSortOption(value: string): value is SortOption {
  return value === "relevance" || value === "newest" || value === "team_size" || value === "name";
}

function topValues(items: Array<{ value: string; count: number }> | undefined, n: number) {
  if (!items) return [];
  return items.slice(0, n).map((item) => item.value);
}

function pickFacetSnapshot(facets: FacetCounts | null) {
  if (!facets) return null;
  return {
    tags: topValues(facets.tags, 80),
    industries: topValues(facets.industries, 40),
    batches: topValues(facets.batches, 40),
    stages: topValues(facets.stages, 20),
    regions: topValues(facets.regions, 30),
  };
}

function buildFacetInstructions(facets: FacetCounts | null): string {
  if (!facets) return "";
  const tags = topValues(facets.tags, 60);
  const industries = topValues(facets.industries, 30);
  const batches = topValues(facets.batches, 30);
  const stages = topValues(facets.stages, 15);
  const regions = topValues(facets.regions, 20);

  if (tags.length === 0 && industries.length === 0 && batches.length === 0) {
    return "";
  }

  return [
    "When the user requests a search, FIRST try to map their request onto these existing facet values:",
    industries.length ? `- industries: ${industries.join(", ")}` : "",
    tags.length ? `- tags: ${tags.join(", ")}` : "",
    batches.length ? `- batches: ${batches.join(", ")}` : "",
    stages.length ? `- stages: ${stages.join(", ")}` : "",
    regions.length ? `- regions: ${regions.join(", ")}` : "",
    "",
    "Rules:",
    "- Only use a facet value if it's an EXACT match (case-sensitive) for what the user means.",
    "  Don't substitute close cousins (e.g. don't pick 'Healthcare' when they said 'sleep apnea').",
    "- If multiple facet values fit, pass them all (the search ORs within a category).",
    "- If NO facet matches the user's intent, pass their phrase as the `query` field instead. The",
    "  backend runs hybrid keyword + semantic search across descriptions and snapshots, so",
    "  free-text questions like 'agentic accounting' or 'B2B for plumbers' work well that way.",
    "- You can combine: e.g. industries=['Fintech'] AND query='infra for emerging markets'.",
    "- DO NOT pass the `batches` filter for vague time terms like 'recent', 'latest', 'last year',",
    "  'this year'. Batches are discrete partitions — combining one with a topic usually returns",
    "  zero matches. For recency, just rely on the topic in `query`; for searchCompanies, also pass",
    "  `sort: 'newest'`. Only pass `batches` when the user names a specific batch (e.g. 'S24').",
  ]
    .filter(Boolean)
    .join("\n");
}
