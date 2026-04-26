import { NextResponse } from "next/server";
import { z } from "zod";

import { askKnowledgeBase } from "../../../lib/chat-tools";
import { getOpenAiClient } from "../../../lib/openai";
import { checkAndIncrementAnonChat, extractClientIp, hashIp } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
});

const SYSTEM_PROMPT = `You are an analyst helping someone evaluate a startup idea against the YC universe.
You have a short list of YC companies retrieved by semantic search for their question. Use ONLY the
provided context — never invent companies, never speculate beyond what's in the snippets.

Style: 4-6 sentences max. Plainspoken. Lead with the most relevant 2-3 companies, mention them by
name, and briefly say what makes each one relevant. Close with one line on whether the idea looks
crowded, contested, or wide-open based on the matches.

Do not include URLs in your answer — citation cards render separately.`;

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const ip = extractClientIp(request);
    const ipHash = hashIp(ip);
    const decision = await checkAndIncrementAnonChat(ipHash);
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Free preview is limited to one question. Sign up to keep asking.",
          resetAt: decision.resetAt,
        },
        { status: 429 },
      );
    }

    const kb = await askKnowledgeBase({ query: body.question, topK: 4 });

    const citations = kb.results.slice(0, 3).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      batch: row.batch,
      industry: row.industry,
      oneLiner: row.oneLiner,
      ycProfileUrl: row.ycProfileUrl,
      websiteUrl: row.websiteUrl,
    }));

    const contextString = kb.results.length === 0
      ? "No matching companies found in the YC index."
      : kb.results
          .map((row, idx) => {
            const header = `[${idx + 1}] ${row.name}${row.batch ? ` (${row.batch})` : ""}${
              row.industry ? ` — ${row.industry}` : ""
            }`;
            const body = row.snippet || row.oneLiner || "(no description)";
            return `${header}\n${body}`;
          })
          .join("\n\n");

    const openai = getOpenAiClient();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.3,
      max_tokens: 350,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Question: ${body.question}\n\nYC companies retrieved:\n\n${contextString}`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          send("citations", citations);
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              send("delta", delta);
            }
          }
          send("done", {});
        } catch (error) {
          const message = error instanceof Error ? error.message : "Stream error";
          send("error", { message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
