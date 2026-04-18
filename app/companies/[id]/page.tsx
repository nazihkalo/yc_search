import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Building2,
  Globe,
  MapPin,
  Users,
} from "lucide-react";

import { CompaniesForceGraphTab } from "../../../components/graph/companies-force-graph-lazy";
import { CompanyLinksRow } from "../../../components/dashboard/company-links-row";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { badgeStyleFor, nodeColorFor } from "../../../lib/colors";
import { buildCompanyLinks } from "../../../lib/company-links";
import { getCompanyDetail } from "../../../lib/company-details";
import {
  extractDescriptionFromMarkdown,
  extractImagesFromMarkdown,
  extractUrlsFromMarkdown,
} from "../../../lib/snapshot-utils";
import {
  SimilarCompaniesPanel,
  SimilarCompaniesSkeleton,
} from "./similar-companies";

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

  const company = await getCompanyDetail(companyId);
  if (!company) {
    notFound();
  }

  const quickLinks = buildCompanyLinks({
    website: company.website,
    ycUrl: company.url,
    snapshotWebsiteUrl: company.website_url_crawl4ai,
    contentMarkdown: company.content_markdown_crawl4ai,
    additionalContentMarkdown: company.content_markdown_yc_profile,
  });

  const description = company.long_description?.trim()
    || (company.content_markdown_crawl4ai
      ? extractDescriptionFromMarkdown(company.content_markdown_crawl4ai)
      : "")
    || company.one_liner?.trim()
    || "";

  const hasYcProfileContent =
    company.yc_profile_socials.length > 0
    || company.yc_profile_founders.length > 0
    || company.yc_profile_news_items.length > 0
    || company.yc_profile_launches.length > 0
    || Boolean(company.content_markdown_yc_profile);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1280px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Button
          asChild
          type="button"
          variant="outline"
          className="rounded-full border-border/60 bg-background/60 backdrop-blur"
        >
          <Link href={safeReturnTo}>
            <ArrowLeft className="size-4" />
            Back to search
          </Link>
        </Button>
        <ThemeToggle />
      </div>

      <Hero company={company} quickLinks={quickLinks} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <DescriptionSection description={description} tags={company.tags} />

          {(company.content_markdown_crawl4ai || company.scrape_error_crawl4ai) ? (
            <WebsiteSnapshotCard
              websiteUrl={company.website_url_crawl4ai ?? company.website}
              scrapedAt={company.scraped_at_crawl4ai}
              scrapeError={company.scrape_error_crawl4ai}
              contentMarkdown={company.content_markdown_crawl4ai}
            />
          ) : null}

          {hasYcProfileContent ? (
            <YcProfileSection
              founders={company.yc_profile_founders}
              enrichedFounders={company.enriched_founders}
              launches={company.yc_profile_launches}
              news={company.yc_profile_news_items}
              socials={company.yc_profile_socials}
              fallbackMarkdown={company.content_markdown_yc_profile}
              profileUrl={company.website_url_yc_profile ?? company.url}
              scrapedAt={company.scraped_at_yc_profile}
            />
          ) : null}

          <Card className="overflow-hidden border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-xl">Embedding neighborhood</CardTitle>
              <CardDescription>
                The 40 most semantically similar companies, drawn from the same 3D graph used across the app. Click a node to open it.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative h-[540px] w-full border-t border-border/50">
                <CompaniesForceGraphTab
                  baseQueryString={`focusId=${companyId}&maxNodes=40&k=5`}
                  returnToPath={`/companies/${companyId}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <MetaSidebar company={company} />

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Similar companies</CardTitle>
              <CardDescription>
                Semantic neighbors from embeddings over metadata, web snapshots, and YC profile content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<SimilarCompaniesSkeleton />}>
                <SimilarCompaniesPanel companyId={companyId} />
              </Suspense>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompanyDetail>>>;

function Hero({
  company,
  quickLinks,
}: {
  company: CompanyDetail;
  quickLinks: ReturnType<typeof buildCompanyLinks>;
}) {
  const chips: Array<{ key: string; label: string; accent?: string }> = [];
  if (company.batch) chips.push({ key: "batch", label: company.batch, accent: `batch:${company.batch}` });
  if (company.stage) chips.push({ key: "stage", label: company.stage, accent: `stage:${company.stage}` });
  if (company.industry) chips.push({ key: "industry", label: company.industry, accent: `ind:${company.industry}` });
  if (company.status) chips.push({ key: "status", label: company.status, accent: `status:${company.status}` });

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card via-card/70 to-primary/15 p-6 shadow-xl shadow-black/20 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-32 size-[420px] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 bottom-0 h-40 w-[360px] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex shrink-0 items-start gap-5">
          {company.small_logo_thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.small_logo_thumb_url}
              alt={`${company.name} logo`}
              className="size-20 rounded-2xl border border-border/60 bg-background/60 object-cover shadow-lg shadow-black/20 backdrop-blur"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-2xl border border-border/60 bg-background/60 text-lg font-semibold text-muted-foreground backdrop-blur">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {company.top_company ? (
              <Badge variant="default" className="rounded-full">
                Top company
              </Badge>
            ) : null}
            {company.is_hiring ? (
              <Badge variant="success" className="rounded-full">
                Hiring
              </Badge>
            ) : null}
            {company.nonprofit ? (
              <Badge variant="secondary" className="rounded-full">
                Nonprofit
              </Badge>
            ) : null}
          </div>

          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[1.02] tracking-tight text-foreground sm:text-6xl"
          >
            {company.name}
          </h1>

          {company.one_liner ? (
            <p className="mt-4 max-w-2xl text-lg leading-snug text-muted-foreground sm:text-xl">
              {company.one_liner}
            </p>
          ) : null}

          {chips.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="tinted"
                  className="border"
                  style={badgeStyleFor(chip.accent ?? chip.label)}
                >
                  {chip.label}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            <CompanyLinksRow links={quickLinks} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DescriptionSection({
  description,
  tags,
}: {
  description: string;
  tags: string[];
}) {
  if (!description && tags.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-3xl italic tracking-tight text-foreground">
          What they do
        </h2>
      </div>
      {description ? (
        <div className="prose prose-invert max-w-none">
          {description.split(/\n{2,}/).map((paragraph, index) => (
            <p
              key={index}
              className="whitespace-pre-wrap text-lg leading-relaxed text-foreground/90"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((tag) => (
            <Badge
              key={`tag-${tag}`}
              variant="tinted"
              className="border"
              style={badgeStyleFor(`tag:${tag}`)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MetaSidebar({ company }: { company: CompanyDetail }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Snapshot</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3">
          <MetaItem icon={<Building2 className="size-4" />} label="Status" value={company.status ?? "—"} />
          <MetaItem
            icon={<Users className="size-4" />}
            label="Team size"
            value={company.team_size ? company.team_size.toLocaleString() : "—"}
          />
          <MetaItem icon={<MapPin className="size-4" />} label="Location" value={company.all_locations ?? "—"} />
          <MetaItem
            icon={<CalendarDays className="size-4" />}
            label="Launched"
            value={company.launched_year ? String(company.launched_year) : "—"}
          />
          <MetaItem
            icon={<Briefcase className="size-4" />}
            label="Subindustry"
            value={company.subindustry ?? "—"}
            span={2}
          />
          {company.website ? (
            <MetaLink
              icon={<Globe className="size-4" />}
              label="Website"
              href={company.website}
              span={2}
            />
          ) : null}
          {company.url ? (
            <MetaLink
              icon={<ArrowUpRight className="size-4" />}
              label="YC profile"
              href={company.url}
              span={2}
            />
          ) : null}
        </dl>

        {(company.industries.length > 0 || company.regions.length > 0) ? (
          <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
            {company.industries.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Industries
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {company.industries.map((industry) => (
                    <Badge
                      key={industry}
                      variant="tinted"
                      className="border"
                      style={badgeStyleFor(`ind:${industry}`)}
                    >
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {company.regions.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Regions
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {company.regions.map((region) => (
                    <Badge key={region} variant="outline">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetaItem({
  icon,
  label,
  value,
  span = 1,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function MetaLink({
  icon,
  label,
  href,
  span = 1,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground transition hover:text-primary"
        >
          <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
          <ArrowUpRight className="size-3.5 shrink-0" />
        </a>
      </dd>
    </div>
  );
}

function WebsiteSnapshotCard({
  websiteUrl,
  scrapedAt,
  scrapeError,
  contentMarkdown,
}: {
  websiteUrl: string | null;
  scrapedAt: string | null;
  scrapeError: string | null;
  contentMarkdown: string | null;
}) {
  const excerpt = contentMarkdown ? extractDescriptionFromMarkdown(contentMarkdown) : "";
  const images = contentMarkdown ? extractImagesFromMarkdown(contentMarkdown, 6) : [];
  const urls = contentMarkdown ? extractUrlsFromMarkdown(contentMarkdown).slice(0, 10) : [];
  const scrapedLabel = scrapedAt ? new Date(scrapedAt).toLocaleDateString() : null;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-xl">From their website</CardTitle>
          {scrapedLabel ? (
            <span className="text-xs text-muted-foreground">Scraped {scrapedLabel}</span>
          ) : null}
        </div>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {websiteUrl.replace(/^https?:\/\//, "")}
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {scrapeError ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Scrape error: {scrapeError}
          </p>
        ) : null}

        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="aspect-video w-full rounded-xl border border-border/50 bg-muted/30 object-cover"
                loading="lazy"
              />
            ))}
          </div>
        ) : null}

        {excerpt ? (
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
              {excerpt}
            </p>
          </div>
        ) : null}

        {urls.length > 0 ? (
          <details className="group rounded-2xl border border-border/60 bg-background/40 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground group-open:text-foreground">
                <Globe className="size-3.5" />
                {urls.length} link{urls.length === 1 ? "" : "s"} found
              </span>
            </summary>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {url.replace(/^https?:\/\//, "").slice(0, 48)}
                </a>
              ))}
            </div>
          </details>
        ) : null}

        {contentMarkdown ? (
          <details className="group rounded-2xl border border-border/60 bg-background/40 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
              <span className="text-muted-foreground group-open:text-foreground">Full snapshot</span>
            </summary>
            <div className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-background/70 p-3">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {contentMarkdown}
              </pre>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function YcProfileSection({
  founders,
  enrichedFounders,
  launches,
  news,
  socials,
  fallbackMarkdown,
  profileUrl,
  scrapedAt,
}: {
  founders: CompanyDetail["yc_profile_founders"];
  enrichedFounders: CompanyDetail["enriched_founders"];
  launches: CompanyDetail["yc_profile_launches"];
  news: CompanyDetail["yc_profile_news_items"];
  socials: CompanyDetail["yc_profile_socials"];
  fallbackMarkdown: string | null;
  profileUrl: string | null;
  scrapedAt: string | null;
}) {
  const scrapedLabel = scrapedAt ? new Date(scrapedAt).toLocaleDateString() : null;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-xl">On Y Combinator</CardTitle>
          {scrapedLabel ? (
            <span className="text-xs text-muted-foreground">Scraped {scrapedLabel}</span>
          ) : null}
        </div>
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {profileUrl.replace(/^https?:\/\//, "")}
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {socials.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socials.map((link) => (
              <a
                key={`social-${link.label}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                {link.label}
                <ArrowUpRight className="size-3" />
              </a>
            ))}
          </div>
        ) : null}

        {enrichedFounders.length > 0 ? (
          <EnrichedFoundersSection founders={enrichedFounders} />
        ) : founders.length > 0 ? (
          <section>
            <h3 className="font-[family-name:var(--font-display)] text-2xl italic tracking-tight text-foreground">
              Founders
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {founders.map((founder) => (
                <div
                  key={founder.fullName}
                  className="rounded-2xl border border-border/50 bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{founder.fullName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {founder.title ?? "Founder"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {founder.linkedinUrl ? (
                        <a
                          href={founder.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          in
                        </a>
                      ) : null}
                      {founder.twitterUrl ? (
                        <a
                          href={founder.twitterUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          X
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {founder.bio ? (
                    <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                      {founder.bio}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {launches.length > 0 ? (
          <section>
            <h3 className="font-[family-name:var(--font-display)] text-2xl italic tracking-tight text-foreground">
              Launches
            </h3>
            <div className="mt-4 space-y-3">
              {launches.map((launch) => (
                <div
                  key={`${launch.title}-${launch.url ?? launch.publishedAt ?? ""}`}
                  className="rounded-2xl border border-border/50 bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{launch.title}</p>
                      {launch.tagline ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {launch.tagline}
                        </p>
                      ) : null}
                      {launch.publishedAt ? (
                        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                          {new Date(launch.publishedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {launch.url ? (
                        <a
                          href={launch.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          Open
                          <ArrowUpRight className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {news.length > 0 ? (
          <section>
            <h3 className="font-[family-name:var(--font-display)] text-2xl italic tracking-tight text-foreground">
              In the news
            </h3>
            <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/50 bg-background/30">
              {news.map((item) => (
                <li key={`${item.title}-${item.url ?? item.date ?? ""}`} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {item.date ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
                      ) : null}
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Read
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {enrichedFounders.length === 0 && founders.length === 0 && launches.length === 0 && news.length === 0 && fallbackMarkdown ? (
          <details className="group rounded-2xl border border-border/60 bg-background/40 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
              <span className="text-muted-foreground group-open:text-foreground">
                YC profile snapshot (raw)
              </span>
            </summary>
            <div className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-background/70 p-3">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {fallbackMarkdown}
              </pre>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EnrichedFoundersSection({
  founders,
}: {
  founders: CompanyDetail["enriched_founders"];
}) {
  return (
    <section>
      <h3 className="font-[family-name:var(--font-display)] text-2xl italic tracking-tight text-foreground">
        Founders
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {founders.map((founder) => (
          <div
            key={founder.id}
            className="rounded-2xl border border-border/50 bg-background/40 p-4"
          >
            <div className="flex items-start gap-3">
              <FounderAvatar founder={founder} />
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{founder.fullName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {founder.title ?? "Founder"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {founder.linkedinUrl ? (
                      <FounderPill href={founder.linkedinUrl} label="in" />
                    ) : null}
                    {founder.twitterUrl ? (
                      <FounderPill href={founder.twitterUrl} label="X" />
                    ) : null}
                    {founder.githubUrl ? (
                      <FounderPill href={founder.githubUrl} label="gh" />
                    ) : null}
                    {founder.personalSiteUrl ? (
                      <FounderPill href={founder.personalSiteUrl} label="site" />
                    ) : null}
                    {founder.wikipediaUrl ? (
                      <FounderPill href={founder.wikipediaUrl} label="wiki" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {founder.bio ? (
              <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                {founder.bio}
              </p>
            ) : null}

            {founder.background ? (
              <div className="mt-3 rounded-xl border border-border/50 bg-background/30 p-3 text-xs">
                {founder.background.summary ? (
                  <p className="text-muted-foreground">{founder.background.summary}</p>
                ) : null}
                {founder.background.previousCompanies.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Previously
                    </p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {founder.background.previousCompanies.slice(0, 5).map((entry, idx) => (
                        <li key={`${founder.id}-prev-${idx}`}>
                          <span className="font-medium text-foreground">{entry.name}</span>
                          {entry.role ? <span> — {entry.role}</span> : null}
                          {entry.years ? <span className="text-muted-foreground/70"> ({entry.years})</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {founder.background.education.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Education
                    </p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {founder.background.education.slice(0, 3).map((entry, idx) => (
                        <li key={`${founder.id}-edu-${idx}`}>
                          <span className="font-medium text-foreground">{entry.school}</span>
                          {entry.degree || entry.field ? (
                            <span> — {[entry.degree, entry.field].filter(Boolean).join(", ")}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {founder.background.notableActivities.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Notable
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {founder.background.notableActivities.slice(0, 4).map((activity, idx) => (
                        <li key={`${founder.id}-act-${idx}`}>{activity}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {founder.github ? (
              <div className="mt-3 rounded-xl border border-border/50 bg-background/30 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">@{founder.github.username}</span>
                  {founder.github.publicRepos != null ? (
                    <span>{founder.github.publicRepos} repos</span>
                  ) : null}
                  {founder.github.followers != null ? (
                    <span>{founder.github.followers} followers</span>
                  ) : null}
                  {founder.github.topLanguages.slice(0, 3).map((entry) => (
                    <span
                      key={`${founder.id}-lang-${entry.language}`}
                      className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]"
                    >
                      {entry.language}
                    </span>
                  ))}
                </div>
                {founder.github.bio ? (
                  <p className="mt-2 line-clamp-2 text-muted-foreground">
                    {founder.github.bio}
                  </p>
                ) : null}
                {founder.github.topRepos.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {founder.github.topRepos.slice(0, 3).map((repo) => (
                      <li key={`${founder.id}-repo-${repo.url}`}>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-start justify-between gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium text-foreground/90 group-hover:text-foreground">
                              {repo.name}
                            </span>
                            {repo.description ? (
                              <span className="ml-1 text-muted-foreground/80">
                                · {repo.description}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/80">
                            ★ {repo.stars}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {founder.mentions.length > 0 ? (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Mentioned in
                </p>
                <ul className="mt-2 space-y-1.5">
                  {founder.mentions.slice(0, 4).map((mention) => (
                    <li key={`${founder.id}-mention-${mention.url}`}>
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <span className="line-clamp-1">
                          {mention.title ?? mention.url}
                          <span className="ml-1 text-[10px] text-muted-foreground/70">({mention.kind})</span>
                        </span>
                        <ArrowUpRight className="mt-0.5 size-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {founder.siteSnapshot?.contentMarkdown ? (
              <details className="mt-3 rounded-xl border border-border/50 bg-background/30 p-3">
                <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                  Personal site excerpt
                </summary>
                <p className="mt-2 line-clamp-[10] whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {founder.siteSnapshot.contentMarkdown.slice(0, 2000)}
                </p>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FounderPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
    >
      {label}
    </a>
  );
}

function FounderAvatar({
  founder,
}: {
  founder: CompanyDetail["enriched_founders"][number];
}) {
  const githubAvatar = founder.github?.username
    ? `https://github.com/${founder.github.username}.png?size=160`
    : null;

  if (githubAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={githubAvatar}
        alt={`${founder.fullName} profile photo`}
        className="size-14 shrink-0 rounded-2xl border border-border/60 bg-background/60 object-cover shadow-sm"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  const color = nodeColorFor(founder.fullName);
  const initials = founder.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/60 text-sm font-semibold shadow-sm"
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 22%, transparent)`,
        color,
      }}
      aria-hidden
    >
      {initials || "·"}
    </div>
  );
}
