"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsResponse } from "./types";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#22c55e",
];

function formatBatchTickLabel(batch: string) {
  const compactMatch = batch.match(/^([WSF])(\d{2})$/i);
  if (compactMatch) {
    return `${compactMatch[1].toUpperCase()}${compactMatch[2]}`;
  }

  const namedMatch = batch.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (namedMatch) {
    const season = namedMatch[1].toLowerCase();
    const seasonShort =
      season === "winter" ? "W" : season === "spring" ? "Sp" : season === "summer" ? "S" : "F";
    return `${seasonShort}${namedMatch[2].slice(2)}`;
  }

  return batch.length > 7 ? batch.slice(0, 7) : batch;
}

export function BatchAnalyticsChart({
  analytics,
  analyticsColorBy,
  hoveredSeries,
  onHoverSeries,
  onLeaveSeries,
  onLegendDrilldown,
  onBarDrilldown,
}: {
  analytics: AnalyticsResponse | null;
  analyticsColorBy: "none" | "tags" | "industries";
  hoveredSeries: string | null;
  onHoverSeries: (series: string | null) => void;
  onLeaveSeries: () => void;
  onLegendDrilldown: (series: string | number | undefined) => void;
  onBarDrilldown: (
    seriesKey: string,
    payload: { payload?: Record<string, string | number | null> } | undefined,
  ) => void;
}) {
  return (
    <div className="h-[360px] w-full lg:h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={analytics?.rows ?? []} margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
          <CartesianGrid vertical={false} stroke="color-mix(in oklch, var(--border) 90%, transparent)" />
          <XAxis
            dataKey="batch"
            interval="preserveStartEnd"
            minTickGap={28}
            tickFormatter={formatBatchTickLabel}
            angle={-32}
            textAnchor="end"
            height={78}
            tickMargin={10}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 16,
              border: "1px solid color-mix(in oklch, var(--border) 80%, transparent)",
              background: "color-mix(in oklch, var(--card) 96%, transparent)",
              color: "var(--foreground)",
            }}
          />
          <Legend
            onClick={(entry: { dataKey?: unknown; value?: string | number }) => {
              const dataKey =
                typeof entry.dataKey === "string" || typeof entry.dataKey === "number" ? entry.dataKey : undefined;
              onLegendDrilldown(dataKey ?? entry.value);
            }}
            onMouseEnter={(entry: { dataKey?: unknown; value?: string | number }) => {
              const dataKey =
                typeof entry.dataKey === "string" || typeof entry.dataKey === "number"
                  ? String(entry.dataKey)
                  : typeof entry.value === "string" || typeof entry.value === "number"
                    ? String(entry.value)
                    : null;
              onHoverSeries(dataKey && dataKey !== "total" ? dataKey : null);
            }}
            onMouseLeave={onLeaveSeries}
          />
          {(analytics?.series ?? []).map((seriesKey, index) => (
            <Bar
              key={seriesKey}
              dataKey={seriesKey}
              stackId={analyticsColorBy === "none" ? undefined : "batch"}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
              radius={analyticsColorBy === "none" ? [10, 10, 0, 0] : [4, 4, 0, 0]}
              cursor="pointer"
              fillOpacity={hoveredSeries && hoveredSeries !== seriesKey ? 0.28 : 1}
              stroke={hoveredSeries === seriesKey ? "var(--foreground)" : undefined}
              strokeWidth={hoveredSeries === seriesKey ? 1.2 : 0}
              activeBar={{ stroke: "var(--foreground)", strokeWidth: 1.5, fillOpacity: 1 }}
              onMouseEnter={() => onHoverSeries(seriesKey)}
              onMouseLeave={onLeaveSeries}
              onClick={(payload) => onBarDrilldown(seriesKey, payload)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
