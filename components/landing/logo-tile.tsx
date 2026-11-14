"use client";

import { useState } from "react";

/** Company logo with a letter fallback for missing or dead image URLs. */
export function LogoTile({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="size-9 rounded-md border border-border bg-white object-contain p-0.5"
      loading="lazy"
    />
  );
}
