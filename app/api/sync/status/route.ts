import { NextResponse } from "next/server";

import { initializeDatabase } from "../../../../lib/db";
import { getLatestSyncStatus } from "../../../../lib/sync-job";

export async function GET() {
  try {
    await initializeDatabase();
    const status = await getLatestSyncStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
