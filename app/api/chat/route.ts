import { NextResponse } from "next/server";
import { z } from "zod";

import { initializeDatabase } from "../../../lib/db";
import { answerCompanyQuestion } from "../../../lib/search";

const bodySchema = z.object({
  question: z.string().trim().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  filters: z
    .object({
      tags: z.array(z.string()).optional(),
      industries: z.array(z.string()).optional(),
      batches: z.array(z.string()).optional(),
      years: z.array(z.number()).optional(),
      stages: z.array(z.string()).optional(),
      regions: z.array(z.string()).optional(),
      isHiring: z.boolean().optional(),
      nonprofit: z.boolean().optional(),
      topCompany: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    initializeDatabase();
    const body = bodySchema.parse(await request.json());
    const response = await answerCompanyQuestion(
      body.question,
      {
        tags: body.filters?.tags ?? [],
        industries: body.filters?.industries ?? [],
        batches: body.filters?.batches ?? [],
        years: body.filters?.years ?? [],
        stages: body.filters?.stages ?? [],
        regions: body.filters?.regions ?? [],
        isHiring: body.filters?.isHiring ?? false,
        nonprofit: body.filters?.nonprofit ?? false,
        topCompany: body.filters?.topCompany ?? false,
      },
      body.topK ?? 8,
    );
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
