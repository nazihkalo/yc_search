import { NextResponse } from "next/server";

import { getOverview } from "../../../lib/overview";

export async function GET() {
  const overview = await getOverview();
  return NextResponse.json(overview, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
