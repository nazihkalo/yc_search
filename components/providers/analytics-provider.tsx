"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { captureEvent, markAnalyticsReady } from "../../lib/analytics/client";
import {
  redactAnalyticsProperties,
  sanitizeAnalyticsUrl,
} from "../../lib/analytics/events";

export function AnalyticsProvider({
  projectKey,
  host,
}: {
  projectKey: string;
  host: string;
}) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const previousUser = useRef<string | null | undefined>(undefined);
  const previousPage = useRef("");
  useEffect(() => {
    if (!projectKey || !isLoaded) return;
    if (!posthog.__loaded)
      posthog.init(projectKey, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        capture_performance: false,
        capture_exceptions: false,
        save_referrer: false,
        save_campaign_params: false,
        capture_dead_clicks: false,
        enable_heatmaps: false,
        disable_external_dependency_loading: true,
        advanced_disable_feature_flags: true,
        disable_surveys: true,
        person_profiles: "identified_only",
        property_denylist: [
          "$initial_current_url",
          "$initial_referrer",
          "$initial_referring_domain",
          "$referrer",
          "$referring_domain",
          "$pathname",
          "$host",
          "$current_url",
          "$search_engine",
          "$search_keyword",
        ],
        before_send: (event) => {
          if (!event) return null;
          event.properties = {
            ...redactAnalyticsProperties(event.properties ?? {}),
            page_path: window.location.pathname,
            $current_url: sanitizeAnalyticsUrl(window.location.href),
            $geoip_disable: true,
            environment: process.env.NODE_ENV,
            is_test: process.env.NODE_ENV !== "production",
          };
          return event;
        },
      });
    const id = user?.id ?? null;
    if (previousUser.current !== id) {
      // Also covers a persisted identity from a previous browser session.
      if (posthog.get_distinct_id() !== id && posthog._isIdentified())
        posthog.reset();
      if (id)
        posthog.identify(id, { signed_up_at: user?.createdAt?.toISOString() });
      previousUser.current = id;
    }
    markAnalyticsReady(true);
    const pageKey = `${id ?? "anonymous"}:${pathname}`;
    if (previousPage.current !== pageKey) {
      captureEvent("$pageview", { page_path: pathname });
      if (id && !previousPage.current.startsWith(`${id}:`)) {
        captureEvent("user_session_started");
        // Repair missing webhook deliveries using a server-verified Clerk profile.
        fetch("/api/me", { method: "POST" }).catch(() => {});
      }
      previousPage.current = pageKey;
    }
  }, [projectKey, host, isLoaded, user, pathname]);
  return null;
}
