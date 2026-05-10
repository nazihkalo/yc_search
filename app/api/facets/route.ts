import { NextResponse } from "next/server";

import { hasDatabaseUrl, initializeDatabase } from "../../../lib/db";
import { getFacets } from "../../../lib/search";

export async function GET() {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        tags: [],
        industries: [],
        batches: [],
        regions: [],
        stages: [],
        years: [],
        sources: [],
      });
    }

    await initializeDatabase();
    const facets = await getFacets();
    return NextResponse.json(facets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
