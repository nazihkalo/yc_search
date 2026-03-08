import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { CompanyEmbeddingMap } from "../../../components/company-embedding-map";
import { CompanyLinksRow } from "../../../components/dashboard/company-links-row";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { buildCompanyLinks } from "../../../lib/company-links";
import { getCompanyDetail, getSimilarCompanies } from "../../../lib/company-details";
import { initializeDatabase } from "../../../lib/db";
import { extractDescriptionFromMarkdown, extractUrlsFromMarkdown } from "../../../lib/snapshot-utils";

function Pill({ children, variant = "outline" }: { children: React.ReactNode; variant?: "outline" | "default" | "secondary" | "success" }) {
  return (
    <Badge variant={variant} className="rounded-full">
      {children}
    </Badge>
  );
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const companyId = Number(id);
  if (!Number.isFinite(companyId)) {
    notFound();
  }

  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : "/";

  await initializeDatabase();
  const company = await getCompanyDetail(companyId);
  if (!company) {
    notFound();
  }

  const similarCompanies = await getSimilarCompanies(companyId, 8);
  const quickLinks = buildCompanyLinks({
    website: company.website,
    ycUrl: company.url,
    snapshotWebsiteUrl: company.website_url_crawl4ai,
    contentMarkdown: company.content_markdown_crawl4ai,
    additionalContentMarkdown: company.content_markdown_yc_profile,
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Button asChild type="button" variant="outline" className="rounded-full">
          <Link href={safeReturnTo}>
            <ArrowLeft className="size-4" />
            Back to search
          </Link>
        </Button>
        <ThemeToggle />
      </div>

      <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--card)_88%,transparent),color-mix(in_oklch,var(--primary)_8%,var(--card)))]">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              {company.small_logo_thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.small_logo_thumb_url}
                  alt={`${company.name} logo`}
                  className="size-16 rounded-2xl border border-border/70 object-cover shadow-sm"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-muted text-sm text-muted-foreground">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{company.name}</h1>
                  {company.top_company ? <Pill>Top company</Pill> : null}
                </div>
                <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">
                  {company.one_liner ?? "No one-liner available."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {company.batch ? <Pill>{company.batch}</Pill> : null}
                  {company.stage ? <Pill>{company.stage}</Pill> : null}
                  {company.industry ? <Pill variant="secondary">{company.industry}</Pill> : null}
                  {company.is_hiring ? <Pill variant="success">Hiring</Pill> : null}
                  {company.nonprofit ? <Pill variant="secondary">Nonprofit</Pill> : null}
                </div>
                <div className="mt-5">
                  <CompanyLinksRow links={quickLinks} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Building2 className="size-4" />} label="Status" value={company.status ?? "N/A"} />
            <MetricCard icon={<MapPin className="size-4" />} label="Location" value={company.all_locations ?? "N/A"} />
            <MetricCard
              icon={<Users className="size-4" />}
              label="Team size"
              value={company.team_size ? company.team_size.toLocaleString() : "N/A"}
            />
            <MetricCard
              icon={<CalendarDays className="size-4" />}
              label="Launched"
              value={company.launched_year ? String(company.launched_year) : "N/A"}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>Company profile</CardTitle>
              <CardDescription>Core YC metadata and the structured fields driving search and ranking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <InfoGrid
                items={[
                  { label: "Website", value: company.website, isLink: true },
                  { label: "YC Profile", value: company.url, isLink: true },
                  { label: "Subindustry", value: company.subindustry },
                  {
                    label: "Former names",
                    value: company.former_names.length ? company.former_names.join(", ") : null,
                  },
                ]}
              />

              <SectionList title="Tags" values={company.tags} />
              <SectionList title="Industries" values={company.industries} />
              <SectionList title="Regions" values={company.regions} />

              {company.long_description ? (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Long description</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{company.long_description}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {(company.yc_profile_socials.length > 0
            || company.yc_profile_founders.length > 0
            || company.yc_profile_news_items.length > 0
            || company.yc_profile_launches.length > 0
            || company.content_markdown_yc_profile) ? (
              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle>YC live profile</CardTitle>
                  <CardDescription>Structured data extracted from the live Y Combinator company page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <InfoGrid
                    items={[
                      { label: "YC page", value: company.website_url_yc_profile ?? company.url, isLink: true },
                      {
                        label: "Last scraped",
                        value: company.scraped_at_yc_profile
                          ? new Date(company.scraped_at_yc_profile).toLocaleString()
                          : null,
                      },
                    ]}
                  />

                  {company.yc_profile_socials.length > 0 ? (
                    <StructuredLinkList title="Company socials" links={company.yc_profile_socials} />
                  ) : null}

                  {company.yc_profile_founders.length > 0 ? (
                    <FounderList founders={company.yc_profile_founders} />
                  ) : null}

                  {company.yc_profile_news_items.length > 0 ? (
                    <NewsList items={company.yc_profile_news_items} />
                  ) : null}

                  {company.yc_profile_launches.length > 0 ? (
                    <LaunchList launches={company.yc_profile_launches} />
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

          {(company.content_markdown_crawl4ai || company.scrape_error_crawl4ai) ? (
            <SnapshotPreview
              source="Crawl4AI snapshot"
              websiteUrl={company.website_url_crawl4ai}
              scrapedAt={company.scraped_at_crawl4ai}
              scrapeError={company.scrape_error_crawl4ai}
              contentMarkdown={company.content_markdown_crawl4ai}
            />
          ) : null}

          {(company.content_markdown_yc_profile || company.scrape_error_yc_profile) ? (
            <SnapshotPreview
              source="YC profile snapshot"
              websiteUrl={company.website_url_yc_profile}
              scrapedAt={company.scraped_at_yc_profile}
              scrapeError={company.scrape_error_yc_profile}
              contentMarkdown={company.content_markdown_yc_profile}
            />
          ) : null}

          <CompanyEmbeddingMap companyId={companyId} />
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>Similar companies</CardTitle>
              <CardDescription>Embedding-based neighbors over metadata, website snapshots, and YC profile snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {similarCompanies.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  No embedding-based matches available yet.
                </p>
              ) : (
                similarCompanies.map((item) => (
                  <Link
                    key={item.id}
                    href={`/companies/${item.id}`}
                    className="block rounded-2xl border border-border/70 bg-background/55 p-4 transition hover:border-primary/30 hover:bg-background/75"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.one_liner ?? "No one-liner available."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.batch ? <Pill>{item.batch}</Pill> : null}
                          {item.stage ? <Pill>{item.stage}</Pill> : null}
                          {item.industry ? <Pill variant="secondary">{item.industry}</Pill> : null}
                        </div>
                      </div>
                      <Pill variant="secondary">sim {item.similarity.toFixed(3)}</Pill>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{ label: string; value: string | null; isLink?: boolean }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border/70 bg-background/55 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
          {item.value ? (
            item.isLink ? (
              <a
                href={item.value}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 break-all text-sm hover:text-primary"
              >
                <span>{item.value}</span>
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <p className="mt-3 text-sm">{item.value}</p>
            )
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">N/A</p>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {values.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <Pill key={`${title}-${value}`}>{value}</Pill>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">N/A</p>
      )}
    </div>
  );
}

function StructuredLinkList({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; url: string }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${title}-${link.label}-${link.url}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm transition hover:text-primary"
          >
            <span>{link.label}</span>
            <ExternalLink className="size-3.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

function FounderList({
  founders,
}: {
  founders: Array<{
    fullName: string;
    title: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    bio: string | null;
  }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">Active founders</h3>
      <div className="mt-3 grid gap-4">
        {founders.map((founder) => (
          <div key={founder.fullName} className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{founder.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{founder.title ?? "Founder"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {founder.linkedinUrl ? (
                  <a
                    href={founder.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs transition hover:text-primary"
                  >
                    LinkedIn
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {founder.twitterUrl ? (
                  <a
                    href={founder.twitterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs transition hover:text-primary"
                  >
                    X
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
            {founder.bio ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{founder.bio}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsList({
  items,
}: {
  items: Array<{ title: string; date: string | null; url: string | null }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">Recent news</h3>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <div key={`${item.title}-${item.url ?? item.date ?? ""}`} className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.date ?? "Date unavailable"}</p>
              </div>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:text-primary">
                  Open
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LaunchList({
  launches,
}: {
  launches: Array<{
    title: string;
    publishedAt: string | null;
    url: string | null;
    ycLaunchUrl: string | null;
    tagline: string | null;
    body: string | null;
  }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">Company launches</h3>
      <div className="mt-3 grid gap-4">
        {launches.map((launch) => (
          <div key={`${launch.title}-${launch.url ?? launch.publishedAt ?? ""}`} className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{launch.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{launch.tagline ?? "No tagline available."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {launch.url ? (
                  <a
                    href={launch.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs transition hover:text-primary"
                  >
                    Launch
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
                {launch.ycLaunchUrl ? (
                  <a
                    href={launch.ycLaunchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs transition hover:text-primary"
                  >
                    YC post
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {launch.publishedAt ? `Published ${new Date(launch.publishedAt).toLocaleDateString()}` : "Published date unavailable"}
            </p>
            {launch.body ? (
              <details className="mt-3 rounded-2xl border border-border/70 bg-background/65 p-3">
                <summary className="cursor-pointer list-none text-sm font-medium">Show launch body</summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{launch.body}</p>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotPreview({
  source,
  websiteUrl,
  scrapedAt,
  scrapeError,
  contentMarkdown,
}: {
  source: string;
  websiteUrl: string | null;
  scrapedAt: string | null;
  scrapeError: string | null;
  contentMarkdown: string | null;
}) {
  const scrapedLabel = scrapedAt ? new Date(scrapedAt).toLocaleString() : null;
  const extractedUrls = contentMarkdown ? extractUrlsFromMarkdown(contentMarkdown) : [];
  const scrapedDescription = contentMarkdown ? extractDescriptionFromMarkdown(contentMarkdown) : "";

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>{source}</CardTitle>
        <CardDescription>Scraped content preview, extracted summary, and outbound links detected from the stored snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <InfoGrid
          items={[
            { label: "Scraped at", value: scrapedLabel },
            { label: "URL", value: websiteUrl, isLink: Boolean(websiteUrl) },
          ]}
        />

        {scrapeError ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Error: {scrapeError}
          </p>
        ) : null}

        {scrapedDescription ? (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Extracted description</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{scrapedDescription}</p>
          </div>
        ) : null}

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Extracted URLs</h3>
          {extractedUrls.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {extractedUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {url}
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No URLs extracted from markdown.</p>
          )}
        </div>

        {contentMarkdown ? (
          <details className="group rounded-2xl border border-border/70 bg-background/55 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
              <span className="group-open:hidden">Expand full snapshot</span>
              <span className="hidden group-open:inline">Collapse full snapshot</span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{contentMarkdown}</p>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">No snapshot content.</p>
        )}
      </CardContent>
    </Card>
  );
}
