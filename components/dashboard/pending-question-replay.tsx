"use client";

import { useEffect } from "react";

const STORAGE_KEY = "yc_pending_question";
const MAX_ATTEMPTS = 30;

/**
 * On mount, reads localStorage.yc_pending_question and pre-fills the CopilotChat
 * textarea so the user can hit Enter to send. Clears the storage after applying
 * so it only fires once per visit. Polls briefly because CopilotChat mounts async.
 */
export function PendingQuestionReplay() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!pending || !pending.trim()) return;

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-test-id="copilot-chat-input"], .copilotKitInput textarea, textarea[placeholder*="YC"]',
      );
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(textarea, pending);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        window.clearInterval(interval);
      } else if (attempts >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
