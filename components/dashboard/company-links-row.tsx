"use client";

import { ExternalLink } from "lucide-react";

import type { CompanyLink } from "../../lib/company-links";
import { cn } from "../../lib/utils";

export function CompanyLinksRow({
  links,
  compact = false,
}: {
  links: CompanyLink[];
  compact?: boolean;
}) {
  if (links.length === 0) {
    return <span className="text-xs text-muted-foreground">No external links</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
      {links.map((link) => (
        <a
          key={`${link.kind}-${link.url}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
            compact && "px-2 py-0.5 text-[11px]",
          )}
        >
          <span>{link.label}</span>
          <ExternalLink className={cn("size-3", compact && "size-2.5")} />
        </a>
      ))}
    </div>
  );
}
