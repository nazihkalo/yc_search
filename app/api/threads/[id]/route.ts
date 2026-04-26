import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePlan } from "../../../../lib/auth";
import {
  deleteThread,
  loadThread,
  saveThreadSnapshot,
  setThreadTitle,
  summarizeThreadTitle,
} from "../../../../lib/chat-store";

const saveSchema = z.object({
  messages: z.array(z.unknown()),
  uiSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  generateTitle: z.boolean().optional(),
  firstUserMessage: z.string().optional(),
});

const renameSchema = z.object({ title: z.string().trim().min(1).max(200) });

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const thread = await loadThread(userId, id);
    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = saveSchema.parse(await request.json());
    await saveThreadSnapshot(userId, id, {
      messages: body.messages,
      uiSnapshot: body.uiSnapshot ?? undefined,
    });

    if (body.generateTitle && body.firstUserMessage) {
      const title = await summarizeThreadTitle(body.firstUserMessage);
      await setThreadTitle(userId, id, title);
      return NextResponse.json({ ok: true, title });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = renameSchema.parse(await request.json());
    await setThreadTitle(userId, id, body.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { userId, allowed } = await requirePlan("free");
    if (!allowed || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const ok = await deleteThread(userId, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
