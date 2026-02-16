"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

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
  selected: "#2563eb",
  similar: "#14b8a6",
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
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Embedding map (2D)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        PCA projection of the selected company and top 100 most similar companies. Click points to open company pages.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-4 h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="PC1" tick={false} axisLine={false} />
              <YAxis type="number" dataKey="y" name="PC2" tick={false} axisLine={false} />
              <Tooltip
                cursor={{ strokeDasharray: "4 4" }}
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
    </section>
  );
}
