"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { useRouter } from "next/navigation";

import { badgeStyleFor, nodeColorFor } from "../../lib/colors";
import type { GraphData, GraphNode } from "../../lib/graph";

type RenderedNode = GraphNode & {
  __color: string;
  __size: number;
  __ring: boolean;
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

export function CompaniesForceGraph({
  data,
  returnToPath,
  onHoverNode,
  isFetching,
}: {
  data: GraphData;
  returnToPath: string;
  onHoverNode?: (node: GraphNode | null) => void;
  isFetching?: boolean;
}) {
  const router = useRouter();
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
      return {
        ...node,
        __color: nodeColorFor(colorKey),
        __size: node.isFocus ? Math.max(baseSize * 2.2, 10) : baseSize,
        __ring: Boolean(node.isFocus),
      };
    });

    const links = data.links.map((link) => ({
      source: link.source,
      target: link.target,
      weight: link.weight,
    }));

    return { nodes, links };
  }, [data, colorBy]);

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
      router.push(
        `/companies/${casted.id}?returnTo=${encodeURIComponent(returnToPath)}`,
      );
    },
    [router, returnToPath],
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
      linkForce.distance(() => 22);
    }
    const chargeForce = instance.d3Force("charge");
    if (chargeForce && "strength" in chargeForce && chargeForce.strength) {
      chargeForce.strength(() => -38);
    }
  }, [preparedData]);

  const buildFocusHalo = useCallback((node: RenderedNode): THREE.Object3D => {
    if (!node.__ring) {
      // Empty object — renders nothing, but satisfies the NodeAccessor type.
      return new THREE.Object3D();
    }
    const haloRadius = Math.max(node.__size * 1.9, 10);
    const geometry = new THREE.SphereGeometry(haloRadius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.__color),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  }, []);

  const hoveredColorKey = hovered ? keyFor(hovered, colorBy) : null;
  const hoveredChipKey = hovered?.batch ?? null;

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
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
        {data.meta.nodeCount} nodes · {data.meta.linkCount} edges
      </div>

      {hovered && tooltipStyle ? (
        <div
          className="pointer-events-none absolute z-20 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl shadow-black/40 backdrop-blur"
          style={{
            left: tooltipStyle.left,
            top: tooltipStyle.top,
            width: tooltipStyle.width,
          }}
        >
          <div className="flex items-start gap-3">
            {hovered.small_logo_thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hovered.small_logo_thumb_url}
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
                {hovered.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {hovered.name}
              </p>
              {hovered.one_liner ? (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {hovered.one_liner}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {hovered.batch ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={badgeStyleFor(`batch:${hoveredChipKey ?? ""}`)}
                  >
                    {hovered.batch}
                  </span>
                ) : null}
                {hovered.industry ? (
                  <span className="text-[10px] text-muted-foreground">
                    · {hovered.industry}
                  </span>
                ) : null}
                {hovered.stage ? (
                  <span className="text-[10px] text-muted-foreground">
                    · {hovered.stage}
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
          const weight = (link as { weight?: number }).weight ?? 0.5;
          return Math.max(0.4, Math.min(weight, 1) * 1.5);
        }}
        linkOpacity={0.22}
        linkColor={() => "rgba(255,255,255,0.35)"}
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
