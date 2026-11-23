"use client";
import { useEffect, useRef } from "react";
import { captureEvent } from "../../lib/analytics/client";
export function DetailAnalytics({
  kind,
  id,
}: {
  kind: "company" | "vendor";
  id: number;
}) {
  const seen = useRef("");
  useEffect(() => {
    const key = `${kind}:${id}`;
    if (seen.current === key) return;
    seen.current = key;
    captureEvent(`${kind}_opened`, { [`${kind}_id`]: id, surface: "page" });
  }, [kind, id]);
  return null;
}
