import { NextResponse } from "next/server";

import { initializeDatabase } from "../../../lib/db";
import { getFocusGraphData, getGraphData } from "../../../lib/graph";
import { parseSearchParams } from "../../../lib/request-parsing";

export async function GET(request: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(request.url);

    const focusRaw = Number(searchParams.get("focusId"));
    const maxNodesRaw = Number(searchParams.get("maxNodes"));
    const kRaw = Number(searchParams.get("k"));
    const kNearest = Number.isFinite(kRaw) && kRaw > 0 ? Math.min(kRaw, 24) : undefined;

    if (Number.isFinite(focusRaw) && focusRaw > 0) {
      const maxNodes = Number.isFinite(maxNodesRaw) && maxNodesRaw > 0 ? Math.min(maxNodesRaw, 200) : 40;
      const data = await getFocusGraphData(focusRaw, {
        maxNodes,
        kNearest: kNearest ?? 5,
      });
      return NextResponse.json(data);
    }

    const params = parseSearchParams(searchParams);
    const maxNodes = Number.isFinite(maxNodesRaw) && maxNodesRaw > 0 ? Math.min(maxNodesRaw, 1000) : 500;
    const data = await getGraphData(params, {
      maxNodes,
      kNearest: kNearest ?? 6,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
