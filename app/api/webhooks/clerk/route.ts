import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

import { execute, initializeDatabase } from "../../../../lib/db";
import { getClerkWebhookSecret } from "../../../../lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = (() => {
    try {
      return getClerkWebhookSecret();
    } catch (error) {
      console.error("[clerk-webhook] missing secret", error);
      return null;
    }
  })();

  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await request.text();

  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.error("[clerk-webhook] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await initializeDatabase();

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, first_name, last_name, image_url } = event.data;
        const primaryEmailId = event.data.primary_email_address_id;
        const primary = email_addresses.find((e) => e.id === primaryEmailId) ?? email_addresses[0];
        const email = primary?.email_address ?? "";
        const name = [first_name, last_name].filter(Boolean).join(" ").trim() || null;

        await execute(
          `
          INSERT INTO users (id, email, name, image_url)
          VALUES (@id, @email, @name, @image_url)
          ON CONFLICT (id) DO UPDATE
          SET email = EXCLUDED.email,
              name = EXCLUDED.name,
              image_url = EXCLUDED.image_url,
              updated_at = NOW()
          `,
          {
            id,
            email,
            name,
            image_url: image_url ?? null,
          },
        );
        break;
      }
      case "user.deleted": {
        const id = event.data.id;
        if (id) {
          await execute("DELETE FROM users WHERE id = @id", { id });
        }
        break;
      }
      default:
        // Ignore unhandled event types — Clerk sends many we don't care about.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[clerk-webhook] handler error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
