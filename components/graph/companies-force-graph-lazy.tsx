"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { GraphData, GraphNode } from "../../lib/graph";

const CompaniesForceGraph = dynamic(
  () => import("./companies-force-graph").then((mod) => mod.CompaniesForceGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Loading graph…
      </div>
    ),
  },
);

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GraphData };

export function CompaniesForceGraphTab({
  baseQueryString,
  returnToPath,
  highlightCompanyId,
  onNodeClick,
}: {
  baseQueryString: string;
  returnToPath: string;
  highlightCompanyId?: number | null;
  onNodeClick?: (node: GraphNode) => void;
}) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [isRefetching, setIsRefetching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const isFirstLoad = state.status === "loading";
    if (!isFirstLoad) setIsRefetching(true);

    const url = `/api/graph?${baseQueryString}&maxNodes=500&k=6`;
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? `HTTP ${response.status}`);
        }
        return response.json() as Promise<GraphData>;
      })
      .then((data) => {
        setState({ status: "ready", data });
        setIsRefetching(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Could not load graph";
        setState({ status: "error", message });
        setIsRefetching(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueryString]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {state.status === "loading" ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Loading graph…
        </div>
      ) : state.status === "error" ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-200">
          Could not load graph: {state.message}
        </div>
      ) : state.data.nodes.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No companies match this filter — narrow your search to render the graph.
        </div>
      ) : (
        <CompaniesForceGraph
          data={state.data}
          returnToPath={returnToPath}
          isFetching={isRefetching}
          highlightCompanyId={highlightCompanyId}
          onNodeClick={onNodeClick}
        />
      )}
    </div>
  );
}
