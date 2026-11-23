import { PostHog } from "posthog-node";
import { after } from "next/server";

let client: PostHog | undefined;
function getClient() {
  const key = process.env.POSTHOG_PROJECT_KEY;
  if (!key) return undefined;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      enableExceptionAutocapture: false,
    });
    client.on("error", () =>
      console.error("[analytics] event delivery failed"),
    );
  }
  return client;
}

/** Analytics failures must never fail an application request. */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
  timestamp?: Date,
) {
  try {
    const posthog = getClient();
    if (!posthog) return;
    posthog.capture({
      distinctId,
      event,
      properties: {
        environment: process.env.NODE_ENV,
        is_test: process.env.NODE_ENV !== "production",
        ...properties,
        $geoip_disable: true,
      },
      timestamp,
    });
    after(async () => {
      try {
        await posthog.flush();
      } catch {
        console.error("[analytics] flush failed");
      }
    });
  } catch {
    console.error("[analytics] capture failed");
  }
}
