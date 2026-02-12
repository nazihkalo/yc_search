import { NextResponse } from "next/server";

import { initializeDatabase } from "../../../lib/db";
import { getFacets } from "../../../lib/search";

export async function GET() {
  try {
    initializeDatabase();
    const facets = getFacets();
    return NextResponse.json(facets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
