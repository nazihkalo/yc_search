"use client";

import Image from "next/image";
import { ExternalLink, Github, Globe, Linkedin, UserRound } from "lucide-react";

import type { CompanyLink } from "../../lib/company-links";
import { cn } from "../../lib/utils";

const IMAGE_ICON_BY_KIND: Partial<Record<CompanyLink["kind"], string>> = {
  website: "/logos/website-globe.svg",
  yc: "/logos/yc.svg",
  x: "/logos/X-white.png",
};

function LinkIcon({ kind, compact }: { kind: CompanyLink["kind"]; compact: boolean }) {
  const imageSrc = IMAGE_ICON_BY_KIND[kind];
  const iconSize = compact ? 14 : 16;

  if (imageSrc) {
    return (
      <span className="flex size-4 items-center justify-center overflow-hidden rounded-sm">
        <Image
          src={imageSrc}
          alt=""
          width={iconSize}
          height={iconSize}
          className={cn("size-4 object-contain", compact && "size-3.5")}
          aria-hidden="true"
        />
      </span>
    );
  }

  if (kind === "linkedin") {
    return <Linkedin className={cn("size-3.5", compact && "size-3")} />;
  }
  if (kind === "founder") {
    return <UserRound className={cn("size-3.5", compact && "size-3")} />;
  }
  if (kind === "github") {
    return <Github className={cn("size-3.5", compact && "size-3")} />;
  }

  return <Globe className={cn("size-3.5", compact && "size-3")} />;
}

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
          aria-label={`${link.label} (${link.url})`}
          title={link.label}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
            compact && "px-2 py-1 text-[11px]",
          )}
        >
          <LinkIcon kind={link.kind} compact={compact} />
          {!compact ? <span>{link.label}</span> : null}
          <ExternalLink className={cn("size-3", compact && "size-2.5")} />
        </a>
      ))}
    </div>
  );
}
