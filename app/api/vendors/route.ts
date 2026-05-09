import { NextResponse } from "next/server";
import { z } from "zod";

import { initializeDatabase } from "../../../lib/db";
import { parseSearchParams } from "../../../lib/request-parsing";
import { getVendorAnalytics } from "../../../lib/vendor-analytics";

const topNSchema = z.coerce.number().int().min(1).max(200).default(50);

function parseCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  try {
    await initializeDatabase();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    const topN = topNSchema.parse(searchParams.get("topN") ?? "50");
    const category = searchParams.get("vendorCategory");
    const sourceListName = searchParams.get("sourceList");
    const relationshipTypes = parseCsv(searchParams.get("relationshipTypes"));

    const analytics = await getVendorAnalytics(params, {
      topN,
      category,
      sourceListName,
      relationshipTypes,
    });
    return NextResponse.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
