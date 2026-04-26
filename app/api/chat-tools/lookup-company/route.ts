import { NextResponse } from "next/server";
import { z } from "zod";

import { recordUsage, requirePlan } from "../../../../lib/auth";
import { lookupCompany } from "../../../../lib/chat-tools";

const bodySchema = z.object({
  idOrSlug: z.union([z.string().min(1), z.number()]),
});

export async function POST(request: Request) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = bodySchema.parse(await request.json());
    recordUsage(userId, "api.lookupCompany");
    const out = await lookupCompany({ idOrSlug: body.idOrSlug });
    if (!out) {
      return NextResponse.json({
        found: false,
        message: `No YC company matched '${body.idOrSlug}'.`,
      });
    }
    return NextResponse.json({ found: true, ...out });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
