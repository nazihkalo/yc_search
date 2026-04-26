import { NextResponse } from "next/server";
import { z } from "zod";

import { recordUsage, requirePlan } from "../../../../lib/auth";
import { findFounders } from "../../../../lib/chat-tools";

const bodySchema = z.object({
  query: z.string().trim().min(1),
  topK: z.number().int().min(1).max(10).optional(),
  filters: z
    .object({
      tags: z.array(z.string()).optional(),
      industries: z.array(z.string()).optional(),
      batches: z.array(z.string()).optional(),
      stages: z.array(z.string()).optional(),
      regions: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = bodySchema.parse(await request.json());
    recordUsage(userId, "api.findFounders");
    const out = await findFounders({
      query: body.query,
      topK: body.topK,
      filters: body.filters,
    });
    return NextResponse.json(out);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
