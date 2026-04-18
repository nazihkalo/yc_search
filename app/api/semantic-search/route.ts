import { NextResponse } from "next/server";

import { recordUsage, requirePlan } from "../../../lib/auth";
import { initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { semanticSearch } from "../../../lib/search";

export async function GET(request: Request) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initializeDatabase();
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    recordUsage(userId, "api.semantic-search");
    const result = await semanticSearch(params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
