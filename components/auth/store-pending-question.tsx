"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "yc_pending_question";

/**
 * Reads ?q=... from the URL and stores it in localStorage so the dashboard
 * can pre-fill the agent chat input after Clerk redirects post-signup.
 * Renders nothing.
 */
export function StorePendingQuestion() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = searchParams.get("q")?.trim();
    if (q && q.length > 0) {
      try {
        window.localStorage.setItem(STORAGE_KEY, q);
      } catch {
        // ignore storage errors
      }
    }
  }, [searchParams]);

  return null;
}
