"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

type Point = {
  id: number;
  name: string;
  x: number;
  y: number;
  group: "selected" | "similar";
};

type EmbeddingMapResponse = {
  method: "PCA";
  selectedCompanyId: number;
  points: Point[];
};

const GROUP_COLORS = {
  selected: "var(--chart-1)",
  similar: "var(--chart-2)",
} as const;

export function CompanyEmbeddingMap({ companyId }: { companyId: number }) {
  const router = useRouter();
  const [data, setData] = useState<EmbeddingMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/companies/${companyId}/embedding-map?limit=100`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        setError(null);
        setData(payload);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load embedding map";
        setError(message);
      });
  }, [companyId]);

  const grouped = useMemo(() => {
    const points = data?.points ?? [];
    return {
      selected: points.filter((point) => point.group === "selected"),
      similar: points.filter((point) => point.group === "similar"),
    };
  }, [data?.points]);

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Embedding map</CardTitle>
        <CardDescription>
          PCA projection of the selected company and the top 100 similar companies. Click points to open another company.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <CartesianGrid stroke="color-mix(in oklch, var(--border) 90%, transparent)" />
                <XAxis type="number" dataKey="x" name="PC1" tick={false} axisLine={false} />
                <YAxis type="number" dataKey="y" name="PC2" tick={false} axisLine={false} />
                <Tooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid color-mix(in oklch, var(--border) 80%, transparent)",
                    background: "color-mix(in oklch, var(--card) 96%, transparent)",
                    color: "var(--foreground)",
                  }}
                  formatter={(_, __, item) => {
                    const payload = item?.payload as Point | undefined;
                    return payload ? [payload.group, payload.name] : ["", ""];
                  }}
                  labelFormatter={() => ""}
                />
                <Legend />
                <Scatter
                  name="Similar companies"
                  data={grouped.similar}
                  fill={GROUP_COLORS.similar}
                  onClick={(point: Point) => router.push(`/companies/${point.id}`)}
                  shape="circle"
                />
                <Scatter
                  name="Selected company"
                  data={grouped.selected}
                  fill={GROUP_COLORS.selected}
                  onClick={(point: Point) => router.push(`/companies/${point.id}`)}
                  shape="star"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
