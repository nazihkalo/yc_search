"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Network,
  Sparkles,
  Twitter,
  Users,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

function openCompany(companyId: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("yc-open-company", { detail: { companyId } }),
  );
}

export type CompanyChatCardData = {
  id: number;
  name: string;
  slug: string | null;
  batch: string | null;
  industry: string | null;
  oneLiner: string | null;
  websiteUrl: string | null;
  ycProfileUrl: string | null;
  companyPage: string;
  logoUrl: string | null;
};

export type FounderChatCardData = {
  name: string;
  title: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  avatarUrl: string | null;
};

export type CompanyDetailChatData = CompanyChatCardData & {
  longDescription: string | null;
  stage: string | null;
  industries: string[];
  tags: string[];
  regions: string[];
  location: string | null;
  isHiring: boolean;
  topCompany: boolean;
  teamSize: number | null;
  launchedYear: number | null;
  founders: FounderChatCardData[];
  topLinks: { url: string; label: string; kind: string }[];
};

export function ToolCallTrace({
  name,
  status,
  args,
  summary,
}: {
  name: string;
  status: "executing" | "inProgress" | "complete" | string;
  args: Record<string, unknown> | undefined;
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const compact = formatArgsCompact(args);
  const dot =
    status === "complete"
      ? "bg-emerald-500"
      : status === "executing"
        ? "bg-amber-400 animate-pulse"
        : "bg-muted-foreground/40";

  return (
    <div className="my-1 rounded-md border border-border/40 bg-background/40 text-[10px] leading-tight">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-muted-foreground transition hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className={cn("size-1.5 rounded-full", dot)} />
        <span className="font-mono font-semibold uppercase tracking-wider">{name}</span>
        {summary ? <span className="truncate text-muted-foreground/80">{summary}</span> : null}
        {!summary && compact ? (
          <span className="truncate text-muted-foreground/70">{compact}</span>
        ) : null}
      </button>
      {open ? (
        <div className="border-t border-border/30 px-2 py-1.5">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
{JSON.stringify(args ?? {}, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function formatArgsCompact(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      parts.push(`${k}=[${v.slice(0, 3).join(",")}${v.length > 3 ? `+${v.length - 3}` : ""}]`);
    } else if (typeof v === "string") {
      if (!v) continue;
      parts.push(`${k}="${v.length > 32 ? v.slice(0, 32) + "…" : v}"`);
    } else {
      parts.push(`${k}=${String(v)}`);
    }
  }
  return parts.join(" ");
}

function LogoOrInitials({ name, logoUrl, size = 40 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="shrink-0 rounded-lg border border-border/60 bg-background object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-[11px] font-semibold uppercase text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2)}
    </div>
  );
}

export function CompanyChatCard({
  company,
  rank,
}: {
  company: CompanyChatCardData;
  rank?: number;
}) {
  const handleGraph = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("yc-show-in-graph", {
        detail: { companyId: company.id, companyName: company.name },
      }),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openCompany(company.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCompany(company.id);
        }
      }}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/60",
        "px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-sm",
      )}
    >
      <LogoOrInitials name={company.name} logoUrl={company.logoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof rank === "number" ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {String(rank).padStart(2, "0")}
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-primary">
            {company.name}
          </span>
          {company.batch ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {company.batch}
            </Badge>
          ) : null}
          {company.industry ? (
            <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
              {company.industry}
            </Badge>
          ) : null}
        </div>
        {company.oneLiner ? (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {company.oneLiner}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleGraph}
        title="Show in graph"
        className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground/70 opacity-0 transition group-hover:opacity-100 hover:border-primary/40 hover:text-primary"
      >
        <Network className="size-3" />
      </button>
    </div>
  );
}

export function CompanyResultsList({
  query,
  totalCandidates,
  results,
}: {
  query: string;
  totalCandidates: number;
  results: CompanyChatCardData[];
}) {
  if (!results || results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        No companies matched <span className="font-medium">{query}</span>.
      </div>
    );
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wider text-muted-foreground/80">
        <Sparkles className="size-3" />
        <span>
          {results.length} of {totalCandidates} matches{query ? <> for &ldquo;{query}&rdquo;</> : null}
        </span>
      </div>
      <BatchSparkline companies={results} />
      <div className="flex flex-col gap-1.5">
        {results.map((company, index) => (
          <CompanyChatCard key={company.id} company={company} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

export function BatchSparkline({ companies }: { companies: CompanyChatCardData[] }) {
  const counts = new Map<string, number>();
  for (const c of companies) {
    if (!c.batch) continue;
    counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
  }
  if (counts.size <= 1) return null;
  const entries = Array.from(counts.entries()).sort(byBatchOrder);
  const max = Math.max(...entries.map(([, n]) => n));

  return (
    <div className="flex items-end gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-2">
      <span className="mr-1 self-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
        batches
      </span>
      {entries.map(([batch, n]) => {
        const heightPct = (n / max) * 100;
        return (
          <div key={batch} className="flex flex-col items-center gap-1">
            <div
              className="w-3 rounded-t bg-primary/60"
              style={{ height: `${Math.max(8, heightPct * 0.32)}px` }}
              title={`${batch}: ${n}`}
            />
            <span className="text-[9px] leading-none text-muted-foreground/80">{batch}</span>
          </div>
        );
      })}
    </div>
  );
}

function byBatchOrder(a: [string, number], b: [string, number]) {
  // Order by year then season; fall back to alphabetical.
  const seasonRank: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
  const parse = (label: string): { year: number; season: number } | null => {
    const long = label.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
    if (long) {
      return {
        year: Number(long[2]),
        season: seasonRank[long[1] as keyof typeof seasonRank] ?? 0,
      };
    }
    const short = label.match(/^([WSF])(\d{2})$/i);
    if (short) {
      const sChar = short[1].toUpperCase();
      const seasonByShort: Record<string, number> = { W: 0, S: 2, F: 3 };
      const yy = Number(short[2]);
      return { year: 2000 + yy, season: seasonByShort[sChar] ?? 0 };
    }
    return null;
  };
  const pa = parse(a[0]);
  const pb = parse(b[0]);
  if (pa && pb) {
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.season - pb.season;
  }
  return a[0].localeCompare(b[0]);
}

export function FounderChatCard({ founder }: { founder: FounderChatCardData }) {
  const initials = founder.name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/60 px-2.5 py-2">
      {founder.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={founder.avatarUrl}
          alt={`${founder.name} avatar`}
          className="size-9 shrink-0 rounded-full border border-border/60 object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
          {initials || "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{founder.name}</div>
        {founder.title ? (
          <div className="truncate text-[11px] text-muted-foreground">{founder.title}</div>
        ) : null}
        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground/70">
          {founder.linkedinUrl ? (
            <SocialIcon href={founder.linkedinUrl} icon={Linkedin} label="LinkedIn" />
          ) : null}
          {founder.twitterUrl ? (
            <SocialIcon href={founder.twitterUrl} icon={Twitter} label="Twitter" />
          ) : null}
          {founder.githubUrl ? (
            <SocialIcon href={founder.githubUrl} icon={Github} label="GitHub" />
          ) : null}
          {founder.personalSiteUrl ? (
            <SocialIcon href={founder.personalSiteUrl} icon={Globe} label="Site" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SocialIcon({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Linkedin;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      className="text-muted-foreground/60 transition hover:text-primary"
    >
      <Icon className="size-3.5" />
    </a>
  );
}

export function CompanyDetailChatCard({ company }: { company: CompanyDetailChatData }) {
  const tags = (company.tags ?? []).slice(0, 6);

  return (
    <div className="my-2 flex flex-col gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
      <div className="flex items-start gap-3">
        <LogoOrInitials name={company.name} logoUrl={company.logoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => openCompany(company.id)}
              className="truncate text-left text-base font-semibold leading-tight text-foreground hover:text-primary hover:underline"
            >
              {company.name}
            </button>
            {company.batch ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {company.batch}
              </Badge>
            ) : null}
            {company.stage ? (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                {company.stage}
              </Badge>
            ) : null}
            {company.topCompany ? (
              <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                Top YC
              </Badge>
            ) : null}
            {company.isHiring ? (
              <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                Hiring
              </Badge>
            ) : null}
          </div>
          {company.oneLiner ? (
            <p className="mt-1 text-xs text-muted-foreground">{company.oneLiner}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/80">
            {company.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {company.location}
              </span>
            ) : null}
            {typeof company.teamSize === "number" ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {company.teamSize}
              </span>
            ) : null}
            {company.industry ? <span>{company.industry}</span> : null}
          </div>
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="muted" className="px-1.5 py-0 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {company.founders.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {company.founders.length === 1 ? "Founder" : "Founders"}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {company.founders.map((founder) => (
              <FounderChatCard key={founder.name} founder={founder} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.dispatchEvent(
              new CustomEvent("yc-show-in-graph", {
                detail: { companyId: company.id, companyName: company.name },
              }),
            );
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <Network className="size-3" />
          Show in graph
        </button>
        {company.topLinks.slice(0, 4).map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="size-3" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function FoundersGrid({ founders }: { founders: FounderChatCardData[] }) {
  if (!founders || founders.length === 0) return null;
  return (
    <div className="my-2 flex flex-col gap-1.5">
      <div className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {founders.length === 1 ? "Founder" : "Founders"}
      </div>
      {founders.map((founder) => (
        <FounderChatCard key={founder.name} founder={founder} />
      ))}
    </div>
  );
}

export type FounderShowcaseFounder = {
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  companyId: number;
  companyName: string;
  companyBatch: string | null;
  companyOneLiner: string | null;
  companyLogoUrl: string | null;
};

export function FounderShowcaseCard({ founder }: { founder: FounderShowcaseFounder }) {
  const initials = founder.name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const blurb = founder.bio?.trim() || null;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-background/70 p-3">
      <div className="flex items-start gap-2.5">
        {founder.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.avatarUrl}
            alt={`${founder.name} avatar`}
            className="size-11 shrink-0 rounded-full border border-border/60 bg-background object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-[11px] font-semibold uppercase text-muted-foreground">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{founder.name}</div>
          {founder.title ? (
            <div className="truncate text-[11px] text-muted-foreground">{founder.title}</div>
          ) : null}
          <div className="mt-1 flex items-center gap-1.5">
            {founder.linkedinUrl ? (
              <SocialIcon href={founder.linkedinUrl} icon={Linkedin} label="LinkedIn" />
            ) : null}
            {founder.twitterUrl ? (
              <SocialIcon href={founder.twitterUrl} icon={Twitter} label="Twitter" />
            ) : null}
            {founder.githubUrl ? (
              <SocialIcon href={founder.githubUrl} icon={Github} label="GitHub" />
            ) : null}
            {founder.personalSiteUrl ? (
              <SocialIcon href={founder.personalSiteUrl} icon={Globe} label="Site" />
            ) : null}
          </div>
        </div>
      </div>
      {blurb ? (
        <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{blurb}</p>
      ) : null}
      <button
        type="button"
        onClick={() => openCompany(founder.companyId)}
        className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-left transition hover:border-primary/40 hover:bg-card"
      >
        {founder.companyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.companyLogoUrl}
            alt={`${founder.companyName} logo`}
            className="size-5 shrink-0 rounded border border-border/60 bg-background object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-5 shrink-0 items-center justify-center rounded border border-border/60 bg-muted text-[8px] font-semibold uppercase text-muted-foreground">
            {founder.companyName.slice(0, 2)}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {founder.companyName}
        </span>
        {founder.companyBatch ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
            {founder.companyBatch}
          </Badge>
        ) : null}
      </button>
    </div>
  );
}

export function FoundersShowcase({
  query,
  totalCompanies,
  founders,
}: {
  query: string;
  totalCompanies: number;
  founders: FounderShowcaseFounder[];
}) {
  if (!founders || founders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        No founders matched <span className="font-medium">{query}</span>.
      </div>
    );
  }
  return (
    <div className="my-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wider text-muted-foreground/80">
        <Users className="size-3" />
        <span>
          {founders.length} founders across {totalCompanies} compan
          {totalCompanies === 1 ? "y" : "ies"}
          {query ? <> for &ldquo;{query}&rdquo;</> : null}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {founders.map((founder, index) => (
          <FounderShowcaseCard key={`${founder.companyId}-${founder.name}-${index}`} founder={founder} />
        ))}
      </div>
    </div>
  );
}
