"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "yc_pending_question";

function readPendingQuestion(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("q")?.trim();
    if (fromUrl) return fromUrl;
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

/** Reminds people that the question they typed on the landing page will be answered after sign-up. */
export function PendingQuestionNote() {
  const question = useSyncExternalStore(subscribe, readPendingQuestion, () => null);
  if (!question) return null;

  return (
    <div className="mt-5 border-l-2 border-primary pl-3 text-sm">
      <p className="text-muted-foreground">We&apos;ll answer this first:</p>
      <p className="mt-0.5 line-clamp-3 text-foreground">&ldquo;{question}&rdquo;</p>
    </div>
  );
}
