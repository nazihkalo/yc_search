import { NextResponse } from "next/server";
import { initializeDatabase } from "../../../lib/db";
import { getSyncEmbedLimit, getSyncScrapeLimit } from "../../../lib/env";
import { runIncrementalSync } from "../../../lib/sync-job";

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    const authHeader = request.headers.get("authorization");
    const token = process.env.SYNC_TOKEN;

    if (token) {
      const expected = `Bearer ${token}`;
      if (authHeader !== expected) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await runIncrementalSync({
      trigger: "manual",
      scrapeLimit: getSyncScrapeLimit(),
      embedLimit: getSyncEmbedLimit(),
    });

    if (!result.ok && result.reason === "already_running") {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
