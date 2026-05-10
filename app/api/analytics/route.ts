import { NextResponse } from "next/server";
import { z } from "zod";

import { hasDatabaseUrl, initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { getBatchAnalytics, getHybridTopCompanyIds } from "../../../lib/search";

const colorBySchema = z.enum(["none", "tags", "industries"]).default("none");
const topNSchema = z.coerce.number().int().min(1).max(20).default(8);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    const colorBy = colorBySchema.parse(searchParams.get("colorBy") ?? "none");
    const topN = topNSchema.parse(searchParams.get("topN") ?? "8");
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        colorBy,
        totalCompanies: 0,
        series: colorBy === "none" ? ["total"] : [],
        rows: [],
      });
    }

    await initializeDatabase();
    const hybridTopLimit = 100;

    const analytics =
      params.query.trim().length > 0
        ? await getBatchAnalytics(params, colorBy, topN, await getHybridTopCompanyIds(params, hybridTopLimit))
        : await getBatchAnalytics(params, colorBy, topN);
    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
