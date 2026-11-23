"use client";
import posthog from "posthog-js";

let ready = false;
export function markAnalyticsReady(value: boolean) {
  ready = value;
}
export function captureEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!ready) return;
  try {
    posthog.capture(event, {
      environment: process.env.NODE_ENV,
      is_test: process.env.NODE_ENV !== "production",
      ...properties,
    });
  } catch {
    // Telemetry must not interrupt the UI.
  }
}
