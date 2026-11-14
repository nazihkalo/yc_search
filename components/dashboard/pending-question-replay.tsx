"use client";

import { useEffect, useRef } from "react";

import { sendToChat } from "../../lib/chat-input";

const STORAGE_KEY = "yc_pending_question";

/**
 * A question typed on the landing page (or passed to /sign-up?q=) is saved to
 * localStorage. After sign-up, send it as the first message of a fresh chat so
 * people land on its answer. Clears the stored value so it only fires once.
 */
export function PendingQuestionReplay() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    // Opening an existing thread should not get a stray question appended.
    if (new URLSearchParams(window.location.search).has("thread")) return;

    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
      if (pending) window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!pending) return;

    firedRef.current = true;
    void sendToChat(pending);
  }, []);

  return null;
}
