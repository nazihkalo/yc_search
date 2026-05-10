import { NextResponse } from "next/server";

import { hasDatabaseUrl, initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { hybridSearch } from "../../../lib/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        results: [],
      });
    }

    await initializeDatabase();
    const result = await hybridSearch(params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
