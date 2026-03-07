"use client";

import { MapPin, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { CompanyLinksRow } from "./company-links-row";
import type { CompanyResult } from "./types";

export function ResultsCardGrid({
  results,
  returnToPath,
  selectedTags,
  selectedIndustries,
  onToggleTag,
  onToggleIndustry,
}: {
  results: CompanyResult[];
  returnToPath: string;
  selectedTags: string[];
  selectedIndustries: string[];
  onToggleTag: (tag: string) => void;
  onToggleIndustry: (industry: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="grid gap-4">
      {results.map((company) => (
        <Card
          key={company.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/companies/${company.id}?returnTo=${encodeURIComponent(returnToPath)}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(`/companies/${company.id}?returnTo=${encodeURIComponent(returnToPath)}`);
            }
          }}
          className="group cursor-pointer overflow-hidden border-border/60 bg-card/90 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                {company.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.small_logo_thumb_url}
                    alt={`${company.name} logo`}
                    className="size-12 rounded-xl border border-border/70 object-cover shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-muted text-xs text-muted-foreground">
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{company.name}</h2>
                    {typeof company.score === "number" ? (
                      <Badge variant="secondary" className="gap-1 rounded-full">
                        <Sparkles className="size-3" />
                        {company.score.toFixed(3)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {company.one_liner ?? "No one-liner available."}
                  </p>
                </div>
              </div>

              <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground md:flex">
                {company.team_size ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {company.team_size}
                  </span>
                ) : null}
                {company.all_locations ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {company.all_locations}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <CompanyLinksRow links={company.top_links} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {company.batch ? <Badge variant="outline">{company.batch}</Badge> : null}
              {company.stage ? <Badge variant="outline">{company.stage}</Badge> : null}
              {company.industry ? <Badge variant="muted">{company.industry}</Badge> : null}
              {company.is_hiring ? <Badge variant="success">Hiring</Badge> : null}
              {company.nonprofit ? <Badge variant="secondary">Nonprofit</Badge> : null}
              {company.top_company ? <Badge>Top company</Badge> : null}
            </div>

            {company.long_description ? (
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{company.long_description}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {company.industries.slice(0, 4).map((industry) => {
                const selected = selectedIndustries.includes(industry);
                return (
                  <button
                    key={`${company.id}-industry-${industry}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleIndustry(industry);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      selected
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {industry}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {company.tags.slice(0, 8).map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={`${company.id}-tag-${tag}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleTag(tag);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      selected
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
