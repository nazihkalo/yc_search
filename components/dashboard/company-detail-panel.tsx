"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Twitter,
  Users,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

type EnrichedFounder = {
  id: number;
  fullName: string;
  title: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  personalSiteUrl: string | null;
  wikipediaUrl: string | null;
  background?: {
    summary: string | null;
    previousCompanies: Array<{ name: string; role: string | null; years: string | null }>;
    education: Array<{ school: string; degree: string | null; field: string | null }>;
    notableActivities: string[];
  } | null;
  github?: {
    username: string | null;
    name: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    publicRepos: number | null;
    followers: number | null;
  } | null;
};

type CompanyDetailPayload = {
  id: number;
  name: string;
  slug: string | null;
  one_liner: string | null;
  long_description: string | null;
  small_logo_thumb_url: string | null;
  website: string | null;
  url: string | null;
  batch: string | null;
  industry: string | null;
  industries: string[];
  tags: string[];
  regions: string[];
  all_locations: string | null;
  stage: string | null;
  team_size: number | null;
  is_hiring: boolean;
  top_company: boolean;
  nonprofit: boolean;
  launched_year: number | null;
  enriched_founders: EnrichedFounder[];
};

type FetchState =
  | { status: "ready"; id: number; company: CompanyDetailPayload }
  | { status: "error"; id: number; message: string };

export function CompanyDetailPanel({
  companyId,
  onClose,
}: {
  companyId: number;
  onClose: () => void;
}) {
  const [state, setState] = useState<FetchState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/companies/${companyId}`)
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ company: CompanyDetailPayload }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setState({ status: "ready", id: companyId, company: payload.company });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load";
        setState({ status: "error", id: companyId, message });
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Loading whenever no state yet OR the in-memory state belongs to a previous id.
  const loading = !state || state.id !== companyId;
  const error = !loading && state?.status === "error" ? state.message : null;
  const company = !loading && state?.status === "ready" ? state.company : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Back to results
        </button>
        {company ? (
          <Link
            href={`/companies/${company.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary"
          >
            Open full page
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      {loading ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn&rsquo;t load company: {error}
        </div>
      ) : company ? (
        <DetailContent company={company} />
      ) : null}
    </div>
  );
}

function DetailContent({ company }: { company: CompanyDetailPayload }) {
  const tags = (company.tags ?? []).slice(0, 12);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-5">
        <div className="flex items-start gap-4">
          {company.small_logo_thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.small_logo_thumb_url}
              alt={`${company.name} logo`}
              className="size-16 rounded-xl border border-border/60 bg-background object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-xl border border-border/60 bg-muted text-sm font-semibold uppercase text-muted-foreground">
              {company.name.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{company.name}</h1>
            {company.one_liner ? (
              <p className="mt-1 text-sm text-muted-foreground">{company.one_liner}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {company.batch ? (
                <Badge variant="outline" className="text-[11px]">
                  {company.batch}
                </Badge>
              ) : null}
              {company.stage ? (
                <Badge variant="muted" className="text-[11px]">
                  {company.stage}
                </Badge>
              ) : null}
              {company.industry ? (
                <Badge variant="muted" className="text-[11px]">
                  {company.industry}
                </Badge>
              ) : null}
              {company.top_company ? (
                <Badge variant="success" className="text-[11px]">
                  Top YC
                </Badge>
              ) : null}
              {company.is_hiring ? (
                <Badge variant="default" className="text-[11px]">
                  Hiring
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {company.all_locations ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {company.all_locations}
            </span>
          ) : null}
          {typeof company.team_size === "number" ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {company.team_size}
            </span>
          ) : null}
          {company.launched_year ? <span>Launched {company.launched_year}</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {company.website ? (
            <DetailLink href={company.website} icon={Globe} label="Website" />
          ) : null}
          {company.url ? <DetailLink href={company.url} icon={ExternalLink} label="YC profile" /> : null}
        </div>
      </header>

      {company.long_description ? (
        <section className="rounded-xl border border-border/60 bg-card/40 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            About
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {company.long_description}
          </p>
        </section>
      ) : null}

      {tags.length > 0 ? (
        <section className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="muted" className="text-[11px]">
              {tag}
            </Badge>
          ))}
        </section>
      ) : null}

      {company.enriched_founders.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {company.enriched_founders.length === 1 ? "Founder" : "Founders"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {company.enriched_founders.map((founder) => (
              <FounderProfileCard key={founder.id} founder={founder} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function FounderProfileCard({ founder }: { founder: EnrichedFounder }) {
  const githubUsername = founder.github?.username ?? extractGithubUsername(founder.githubUrl);
  const avatarUrl = githubUsername ? `https://github.com/${githubUsername}.png?size=160` : null;
  const initials = founder.fullName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const blurb = founder.bio ?? founder.background?.summary ?? founder.github?.bio ?? null;
  const prevCo = founder.background?.previousCompanies?.slice(0, 2) ?? [];
  const edu = founder.background?.education?.slice(0, 1) ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-start gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${founder.fullName} avatar`}
            className="size-12 shrink-0 rounded-full border border-border/60 bg-background object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-xs font-semibold uppercase text-muted-foreground">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{founder.fullName}</div>
          {founder.title ? (
            <div className="truncate text-xs text-muted-foreground">{founder.title}</div>
          ) : null}
          <div className="mt-1.5 flex items-center gap-1.5">
            {founder.linkedinUrl ? (
              <SocialLink href={founder.linkedinUrl} icon={Linkedin} label="LinkedIn" />
            ) : null}
            {founder.twitterUrl ? (
              <SocialLink href={founder.twitterUrl} icon={Twitter} label="Twitter" />
            ) : null}
            {founder.githubUrl ? (
              <SocialLink href={founder.githubUrl} icon={Github} label="GitHub" />
            ) : null}
            {founder.personalSiteUrl ? (
              <SocialLink href={founder.personalSiteUrl} icon={Globe} label="Site" />
            ) : null}
          </div>
        </div>
      </div>
      {blurb ? (
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">{blurb}</p>
      ) : null}
      {(prevCo.length > 0 || edu.length > 0) && (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          {prevCo.map((entry, index) => (
            <div key={index}>
              <span className="font-medium text-foreground/80">{entry.name}</span>
              {entry.role ? <span> — {entry.role}</span> : null}
              {entry.years ? <span className="text-muted-foreground/70"> · {entry.years}</span> : null}
            </div>
          ))}
          {edu.map((entry, index) => (
            <div key={`edu-${index}`}>
              <span className="font-medium text-foreground/80">{entry.school}</span>
              {entry.degree ? <span> — {entry.degree}</span> : null}
              {entry.field ? <span> ({entry.field})</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialLink({
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

function DetailLink({
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
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1 text-xs text-foreground transition hover:border-primary/40 hover:text-primary"
    >
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-32 rounded-xl border border-border/40 bg-muted/30" />
      <div className="h-24 rounded-xl border border-border/40 bg-muted/20" />
      <div className={cn("h-32 rounded-xl border border-border/40 bg-muted/20")} />
    </div>
  );
}

function extractGithubUsername(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/?#]+)/i);
  if (!match) return null;
  const username = match[1].trim();
  if (!username || username === "orgs" || username.includes("/")) return null;
  return username;
}
