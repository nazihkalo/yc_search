import { NextResponse } from "next/server";
import { z } from "zod";

import { initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { getBatchAnalytics, getSemanticTopCompanyIds } from "../../../lib/search";

const colorBySchema = z.enum(["none", "tags", "industries"]).default("none");
const topNSchema = z.coerce.number().int().min(1).max(20).default(8);

export async function GET(request: Request) {
  try {
    initializeDatabase();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    const mode = searchParams.get("mode") === "semantic" ? "semantic" : "keyword";
    const colorBy = colorBySchema.parse(searchParams.get("colorBy") ?? "none");
    const topN = topNSchema.parse(searchParams.get("topN") ?? "8");
    const semanticTopLimit = 100;

    const analytics =
      mode === "semantic" && params.query.trim().length > 0
        ? getBatchAnalytics(
            params,
            colorBy,
            topN,
            await getSemanticTopCompanyIds(params, semanticTopLimit),
          )
        : getBatchAnalytics(params, colorBy, topN);
    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
