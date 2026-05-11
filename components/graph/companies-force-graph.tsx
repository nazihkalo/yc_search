"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { badgeStyleFor, nodeColorFor } from "../../lib/colors";
import type { GraphData, GraphNode } from "../../lib/graph";

type RenderedNode = GraphNode & {
  __color: string;
  __size: number;
  __ring: boolean;
  __highlighted: boolean;
  __projectedX?: number;
  __projectedY?: number;
  __projectedZ?: number;
  vx?: number;
  vy?: number;
  vz?: number;
};

type RenderedLink = {
  source: number | RenderedNode;
  target: number | RenderedNode;
  weight: number;
  type?: string;
  reason?: string;
  __strength: number;
  __distance: number;
};

type ColorBy = "batch" | "industry" | "stage";

const COLOR_BY_LABEL: Record<ColorBy, string> = {
  batch: "Batch",
  industry: "Industry",
  stage: "Stage",
};

function useContainerSize() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;

    const update = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, size };
}

function keyFor(node: GraphNode, by: ColorBy): string {
  if (by === "batch") return node.batch ?? "Unknown batch";
  if (by === "industry") {
    return node.industries[0] ?? node.industry ?? "Unknown industry";
  }
  return node.stage ?? "Unknown stage";
}

function createProjectionForce(strength = 0.045) {
  let nodes: RenderedNode[] = [];
  const force = ((alpha: number) => {
    for (const node of nodes) {
      if (
        typeof node.__projectedX !== "number" ||
        typeof node.__projectedY !== "number" ||
        typeof node.__projectedZ !== "number"
      ) {
        continue;
      }
      node.vx = (node.vx ?? 0) + (node.__projectedX - (node.x ?? 0)) * alpha * strength;
      node.vy = (node.vy ?? 0) + (node.__projectedY - (node.y ?? 0)) * alpha * strength;
      node.vz = (node.vz ?? 0) + (node.__projectedZ - (node.z ?? 0)) * alpha * strength;
    }
  }) as ((alpha: number) => void) & { initialize: (nextNodes: RenderedNode[]) => void };
  force.initialize = (nextNodes: RenderedNode[]) => {
    nodes = nextNodes;
  };
  return force;
}

function normalizeWeight(weight: number, min: number, max: number) {
  if (!Number.isFinite(weight)) return 0.35;
  if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 0.001) {
    return Math.max(0.2, Math.min(1, weight));
  }
  return Math.max(0.05, Math.min(1, (weight - min) / (max - min)));
}

export function CompaniesForceGraph({
  data,
  returnToPath,
  onHoverNode,
  onNodeClick,
  highlightCompanyId,
  isFetching,
}: {
  data: GraphData;
  returnToPath: string;
  onHoverNode?: (node: GraphNode | null) => void;
  onNodeClick?: (node: GraphNode) => void;
  highlightCompanyId?: number | null;
  isFetching?: boolean;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLightTheme = resolvedTheme === "light";
  const { containerRef, size } = useContainerSize();
  // `react-force-graph-3d`'s ref type is generic over its node/link shape. Using `any`
  // keeps the imperative d3Force/cameraPosition access without fighting the generics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [colorBy, setColorBy] = useState<ColorBy>("batch");
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const preparedData = useMemo(() => {
    const maxTeamSize = data.nodes.reduce(
      (max, node) => Math.max(max, node.team_size ?? 0),
      0,
    );

    const nodes: RenderedNode[] = data.nodes.map((node) => {
      const colorKey = keyFor(node, colorBy);
      const scale = node.team_size && maxTeamSize > 0
        ? Math.log10(node.team_size + 1) / Math.log10(maxTeamSize + 1)
        : 0;
      const baseSize = 1 + scale * 6;
      const isHighlighted = node.id === highlightCompanyId;
      const hasProjection =
        typeof node.x === "number" &&
        typeof node.y === "number" &&
        typeof node.z === "number" &&
        Number.isFinite(node.x) &&
        Number.isFinite(node.y) &&
        Number.isFinite(node.z);
      return {
        ...node,
        x: hasProjection ? node.x : undefined,
        y: hasProjection ? node.y : undefined,
        z: hasProjection ? node.z : undefined,
        __projectedX: hasProjection ? node.x : undefined,
        __projectedY: hasProjection ? node.y : undefined,
        __projectedZ: hasProjection ? node.z : undefined,
        __color: nodeColorFor(colorKey),
        __size: node.isFocus
          ? Math.max(baseSize * 2.2, 10)
          : isHighlighted
          ? Math.max(baseSize * 2.5, 12)
          : baseSize,
        __ring: Boolean(node.isFocus),
        __highlighted: isHighlighted,
      };
    });

    const weights = data.links.map((link) => link.weight).filter(Number.isFinite);
    const minWeight = weights.length ? Math.min(...weights) : 0;
    const maxWeight = weights.length ? Math.max(...weights) : 1;
    const links: RenderedLink[] = data.links.map((link) => {
      const strength = normalizeWeight(link.weight, minWeight, maxWeight);
      return {
        source: link.source,
        target: link.target,
        weight: link.weight,
        type: link.type,
        reason: link.reason,
        __strength: strength,
        __distance: 120 - strength * 86,
      };
    });

    return { nodes, links };
  }, [data, colorBy, highlightCompanyId]);

  const legendEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of data.nodes) {
      const key = keyFor(node, colorBy);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count, color: nodeColorFor(key) }));
  }, [data.nodes, colorBy]);

  const handleHover = useCallback(
    (node: unknown) => {
      const casted = (node as GraphNode | null) ?? null;
      setHovered(casted);
      onHoverNode?.(casted);
    },
    [onHoverNode],
  );

  const handleClick = useCallback(
    (node: unknown) => {
      const casted = node as GraphNode | null;
      if (!casted) return;
      if (onNodeClick) {
        onNodeClick(casted);
      } else {
        router.push(
          `/companies/${casted.id}?returnTo=${encodeURIComponent(returnToPath)}`,
        );
      }
    },
    [router, returnToPath, onNodeClick],
  );

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor(null);
    setHovered(null);
  }, []);

  useEffect(() => {
    const instance = graphRef.current;
    if (!instance) return;
    const linkForce = instance.d3Force("link");
    if (linkForce && "distance" in linkForce) {
      linkForce.distance((link: RenderedLink) => link.__distance ?? 58);
    }
    if (linkForce && "strength" in linkForce && linkForce.strength) {
      linkForce.strength((link: RenderedLink) => 0.08 + (link.__strength ?? 0.35) * 0.42);
    }
    const chargeForce = instance.d3Force("charge");
    if (chargeForce && "strength" in chargeForce && chargeForce.strength) {
      chargeForce.strength(() => -30);
    }
    instance.d3Force("projection", createProjectionForce(data.meta.layout === "pca" ? 0.06 : 0));
  }, [data.meta.layout, preparedData]);

  const buildFocusHalo = useCallback((node: RenderedNode): THREE.Object3D => {
    if (!node.__ring && !node.__highlighted) {
      return new THREE.Object3D();
    }
    const haloRadius = Math.max(node.__size * 1.9, 10);
    const geometry = new THREE.SphereGeometry(haloRadius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: node.__highlighted
        ? new THREE.Color(isLightTheme ? 0x1f2937 : 0xffffff)
        : new THREE.Color(node.__color),
      transparent: true,
      opacity: node.__highlighted ? (isLightTheme ? 0.28 : 0.40) : 0.18,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  }, [isLightTheme]);

  const pinnedNode = useMemo(
    () => (highlightCompanyId ? (preparedData.nodes.find((n) => n.id === highlightCompanyId) ?? null) : null),
    [highlightCompanyId, preparedData.nodes],
  );

  const activeNode = hovered ?? pinnedNode;
  const hoveredColorKey = activeNode ? keyFor(activeNode, colorBy) : null;
  const hoveredChipKey = activeNode?.batch ?? null;

  const tooltipStyle = cursor
    ? (() => {
        const width = 280;
        const offset = 18;
        const showLeft = cursor.x + offset + width > size.width;
        const left = showLeft ? cursor.x - offset - width : cursor.x + offset;
        const top = Math.min(Math.max(cursor.y + 14, 0), size.height - 160);
        return { left, top, width };
      })()
    : null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-card/30"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_65%)]" />

      <div className="pointer-events-auto absolute left-4 top-4 z-10 flex flex-col gap-2">
        <div className="rounded-full border border-border/60 bg-background/80 p-1 text-xs backdrop-blur">
          {(["batch", "industry", "stage"] as ColorBy[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColorBy(key)}
              className={`rounded-full px-3 py-1 font-medium transition ${
                colorBy === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {COLOR_BY_LABEL[key]}
            </button>
          ))}
        </div>
        {isFetching ? (
          <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Loading…
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-10 max-w-[220px] rounded-2xl border border-border/60 bg-background/80 p-3 text-xs backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {COLOR_BY_LABEL[colorBy]}
        </p>
        <ul className="mt-2 space-y-1">
          {legendEntries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2 truncate">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate text-foreground/85">{entry.key}</span>
              <span className="ml-auto text-muted-foreground/70">{entry.count}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Edges
          </p>
          <div className="mt-2 flex items-center gap-2 text-foreground/85">
            <span className="h-px w-8 rounded-full bg-foreground/45" />
            <span>Semantic neighbors</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Width follows embedding similarity.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
        {data.meta.nodeCount} nodes · {data.meta.linkCount} edges · {data.meta.layout === "pca" ? "PCA layout" : "force layout"}
      </div>

      {activeNode ? (
        <div
          className="pointer-events-none absolute z-20 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl shadow-foreground/15 backdrop-blur"
          style={
            hovered && tooltipStyle
              ? { left: tooltipStyle.left, top: tooltipStyle.top, width: tooltipStyle.width }
              : { left: 16, bottom: 40, width: 280 }
          }
        >
          {!hovered && pinnedNode ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">
              Referenced company
            </p>
          ) : null}
          <div className="flex items-start gap-3">
            {activeNode.small_logo_thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeNode.small_logo_thumb_url}
                alt=""
                className="size-11 shrink-0 rounded-xl border border-border/60 bg-background/60 object-cover"
              />
            ) : (
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 text-[11px] font-semibold"
                style={{
                  backgroundColor: `color-mix(in oklch, ${hoveredColorKey ? nodeColorFor(hoveredColorKey) : "#888"} 24%, transparent)`,
                  color: hoveredColorKey ? nodeColorFor(hoveredColorKey) : "inherit",
                }}
              >
                {activeNode.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeNode.name}
              </p>
              {activeNode.one_liner ? (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {activeNode.one_liner}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {activeNode.batch ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={badgeStyleFor(`batch:${hoveredChipKey ?? ""}`)}
                  >
                    {activeNode.batch}
                  </span>
                ) : null}
                {activeNode.industry ? (
                  <span className="text-[10px] text-muted-foreground">
                    · {activeNode.industry}
                  </span>
                ) : null}
                {activeNode.stage ? (
                  <span className="text-[10px] text-muted-foreground">
                    · {activeNode.stage}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ForceGraph3D
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={preparedData}
        backgroundColor="rgba(0,0,0,0)"
        nodeColor={(node: unknown) => (node as RenderedNode).__color}
        nodeVal={(node: unknown) => (node as RenderedNode).__size}
        nodeOpacity={0.95}
        nodeResolution={12}
        nodeLabel={(node: unknown) => (node as GraphNode).name}
        nodeThreeObject={(node: unknown) => buildFocusHalo(node as RenderedNode)}
        nodeThreeObjectExtend
        linkWidth={(link: unknown) => {
          const strength = (link as RenderedLink).__strength ?? 0.35;
          return 0.35 + strength * 2.4;
        }}
        linkOpacity={1}
        linkColor={(link: unknown) => {
          const strength = (link as RenderedLink).__strength ?? 0.35;
          const alpha = 0.16 + strength * (isLightTheme ? 0.42 : 0.34);
          return isLightTheme ? `rgba(38,50,66,${alpha})` : `rgba(255,255,255,${alpha})`;
        }}
        linkLabel={(link: unknown) => {
          const rendered = link as RenderedLink;
          const score = Math.round((rendered.weight ?? 0) * 100);
          return `${rendered.reason ?? "Semantic nearest neighbor"} · ${score}%`;
        }}
        onNodeClick={handleClick}
        onNodeHover={handleHover}
        cooldownTicks={80}
        warmupTicks={40}
        enableNodeDrag={false}
      />
    </div>
  );
}

export default CompaniesForceGraph;
