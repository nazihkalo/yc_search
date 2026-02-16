import { NextResponse } from "next/server";

import { initializeDatabase } from "../../../../../lib/db";
import { getCompanyEmbeddingMap } from "../../../../../lib/embedding-map";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    initializeDatabase();
    const { searchParams } = new URL(request.url);
    const { id } = await context.params;
    const companyId = Number(id);
    const limitParam = Number(searchParams.get("limit") ?? "100");
    const similarLimit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(500, Math.floor(limitParam)) : 100;
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const map = getCompanyEmbeddingMap(companyId, similarLimit);
    if (!map) {
      return NextResponse.json({ error: "Embedding map unavailable for this company" }, { status: 404 });
    }

    return NextResponse.json(map);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
