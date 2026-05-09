"use client";

import { useState } from "react";

import { cn } from "../lib/utils";
import { vendorLogoUrl } from "../lib/vendor-logo";

const sizeClasses = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-16 rounded-2xl text-lg",
};

export function VendorLogo({
  name,
  domain,
  size = "md",
  className,
}: {
  name: string;
  domain: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : vendorLogoUrl(domain, size === "lg" ? 128 : 64);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border/60 bg-background/70 font-semibold text-muted-foreground shadow-sm",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} logo`}
          className="size-full rounded-[inherit] object-contain p-1"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
