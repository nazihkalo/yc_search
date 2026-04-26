import { NextResponse } from "next/server";

import { requirePlan } from "../../../../lib/auth";
import { getCompanyDetail } from "../../../../lib/company-details";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { allowed } = await requirePlan("free");
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const detail = await getCompanyDetail(numId);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Strip heavyweight fields not needed by the inline panel.
    const stripped = detail as unknown as Record<string, unknown>;
    delete stripped.vector;
    delete stripped.content_markdown;
    delete stripped.content_markdown_crawl4ai;
    delete stripped.content_markdown_yc_profile;
    delete stripped.api;
    delete stripped.search_text;

    return NextResponse.json({ company: stripped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
