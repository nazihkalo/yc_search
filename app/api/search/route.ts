import { NextResponse } from "next/server";

import { initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { keywordSearch } from "../../../lib/search";

export async function GET(request: Request) {
  try {
    initializeDatabase();
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    const result = keywordSearch(params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
