"use client";

import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { CompanyLinksRow } from "./company-links-row";
import type { CompanyResult } from "./types";

type SortOption = "relevance" | "newest" | "team_size" | "name";

export function ResultsTable({
  results,
  returnToPath,
  selectedTags,
  selectedIndustries,
  sort,
  onSortChange,
  onToggleTag,
  onToggleIndustry,
}: {
  results: CompanyResult[];
  returnToPath: string;
  selectedTags: string[];
  selectedIndustries: string[];
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  onToggleTag: (tag: string) => void;
  onToggleIndustry: (industry: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="-mx-4 overflow-hidden border-y border-border/60 bg-card/95 shadow-sm sm:mx-0 sm:rounded-2xl sm:border">
      <div className="border-b border-border/60 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
        Swipe for more columns
      </div>
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[280px]">Company</TableHead>
            <TableHead className="w-[14%] hidden md:table-cell">Industry</TableHead>
            <TableHead className="w-[16%] hidden lg:table-cell">Category</TableHead>
            <TableHead className="min-w-[110px]">
              <SortButton active={sort === "newest"} onClick={() => onSortChange("newest")} label="Batch" />
            </TableHead>
            <TableHead className="w-[8%] hidden lg:table-cell">Stage</TableHead>
            <TableHead className="w-[8%] hidden md:table-cell">
              <SortButton
                active={sort === "team_size"}
                onClick={() => onSortChange("team_size")}
                label="Team"
              />
            </TableHead>
            <TableHead className="min-w-[120px]">Status</TableHead>
            <TableHead className="w-[12%] hidden sm:table-cell">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((company) => (
            <TableRow
              key={company.id}
              className="cursor-pointer"
              onClick={() => router.push(`/companies/${company.id}?returnTo=${encodeURIComponent(returnToPath)}`)}
            >
              <TableCell>
                <div className="flex items-start gap-3">
                  {company.small_logo_thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.small_logo_thumb_url}
                      alt={`${company.name} logo`}
                      className="mt-0.5 size-10 rounded-xl border border-border/70 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted text-[10px] text-muted-foreground">
                      {company.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{company.name}</p>
                      {typeof company.score === "number" ? (
                        <Badge variant="secondary" className="rounded-full">
                          {company.score.toFixed(3)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {company.one_liner ?? "No one-liner available."}
                    </p>
                    {company.all_locations ? (
                      <p className="mt-1 text-xs text-muted-foreground">{company.all_locations}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 md:hidden">
                      {company.industries.slice(0, 1).map((industry) => (
                        <Badge key={`${company.id}-industry-mobile-${industry}`} variant="muted">
                          {industry}
                        </Badge>
                      ))}
                      {company.is_hiring ? <Badge variant="success">Hiring</Badge> : null}
                      {company.top_company ? <Badge>Top</Badge> : null}
                    </div>
                    <div className="mt-2 sm:hidden">
                      <CompanyLinksRow links={company.top_links.slice(0, 3)} compact />
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-wrap gap-2">
                  {company.industries.slice(0, 2).map((industry) => {
                    const selected = selectedIndustries.includes(industry);
                    return (
                      <button
                        key={`${company.id}-industry-table-${industry}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleIndustry(industry);
                        }}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
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
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-2">
                  {company.tags.slice(0, 3).map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <button
                        key={`${company.id}-tag-table-${tag}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleTag(tag);
                        }}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
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
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{company.batch ?? "N/A"}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{company.stage ?? "N/A"}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {company.team_size ? company.team_size.toLocaleString() : "N/A"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {company.is_hiring ? <Badge variant="success">Hiring</Badge> : null}
                  {company.top_company ? <Badge>Top</Badge> : null}
                  {company.nonprofit ? <Badge variant="secondary">NP</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <CompanyLinksRow links={company.top_links.slice(0, 3)} compact />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-auto px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-transparent",
        active && "text-foreground",
      )}
      onClick={onClick}
    >
      {label}
      <ArrowUpDown className="size-3" />
      <span className="sr-only">Sort by {label}</span>
    </Button>
  );
}
