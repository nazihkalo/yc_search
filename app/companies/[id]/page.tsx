import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyEmbeddingMap } from "../../../components/company-embedding-map";
import { getCompanyDetail, getSimilarCompanies } from "../../../lib/company-details";
import { initializeDatabase } from "../../../lib/db";

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{children}</span>;
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

  initializeDatabase();
  const company = getCompanyDetail(companyId);
  if (!company) {
    notFound();
  }

  const similarCompanies = getSimilarCompanies(companyId, 8);

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href={safeReturnTo} className="text-sm text-zinc-600 underline">
          Back to search
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start gap-4">
          {company.small_logo_thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.small_logo_thumb_url}
              alt={`${company.name} logo`}
              className="h-14 w-14 rounded-md border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
              N/A
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
            <p className="mt-1 text-zinc-600">{company.one_liner ?? "No one-liner available."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {company.batch ? <Pill>{company.batch}</Pill> : null}
              {company.stage ? <Pill>{company.stage}</Pill> : null}
              {company.industry ? <Pill>{company.industry}</Pill> : null}
              {company.is_hiring ? <Pill>Hiring</Pill> : null}
              {company.nonprofit ? <Pill>Nonprofit</Pill> : null}
              {company.top_company ? <Pill>Top company</Pill> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <InfoItem label="Website" value={company.website} isLink />
          <InfoItem label="YC Profile" value={company.url} isLink />
          <InfoItem label="Location" value={company.all_locations} />
          <InfoItem label="Status" value={company.status} />
          <InfoItem label="Team size" value={company.team_size ? String(company.team_size) : null} />
          <InfoItem label="Launched year" value={company.launched_year ? String(company.launched_year) : null} />
          <InfoItem label="Subindustry" value={company.subindustry} />
          <InfoItem
            label="Former names"
            value={company.former_names.length ? company.former_names.join(", ") : null}
          />
        </div>

        <div className="mt-5 space-y-3">
          <SectionList title="Tags" values={company.tags} />
          <SectionList title="Industries" values={company.industries} />
          <SectionList title="Regions" values={company.regions} />
        </div>

        {company.long_description ? (
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-medium text-zinc-700">Long description</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{company.long_description}</p>
          </div>
        ) : null}

        {company.content_markdown_crawl4ai ? (
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-medium text-zinc-700">Website snapshot (Crawl4AI)</h2>
            <SnapshotPreview
              source="Crawl4AI"
              websiteUrl={company.website_url_crawl4ai}
              scrapedAt={company.scraped_at_crawl4ai}
              scrapeError={company.scrape_error_crawl4ai}
              contentMarkdown={company.content_markdown_crawl4ai}
            />
          </div>
        ) : null}
      </section>

      <CompanyEmbeddingMap companyId={companyId} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Similar companies</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ranked with vector similarity over embedded YC metadata and scraped content.
        </p>

        <div className="mt-4 grid gap-3">
          {similarCompanies.length === 0 ? (
            <p className="text-sm text-zinc-500">No embedding-based matches available yet.</p>
          ) : (
            similarCompanies.map((item) => (
              <Link
                key={item.id}
                href={`/companies/${item.id}`}
                className="rounded-lg border border-zinc-200 p-3 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                      {item.one_liner ?? "No one-liner available."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.batch ? <Pill>{item.batch}</Pill> : null}
                      {item.stage ? <Pill>{item.stage}</Pill> : null}
                      {item.industry ? <Pill>{item.industry}</Pill> : null}
                    </div>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    sim {item.similarity.toFixed(3)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      {value ? (
        isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm text-zinc-700 underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-1 text-sm text-zinc-700">{value}</p>
        )
      ) : (
        <p className="mt-1 text-sm text-zinc-400">N/A</p>
      )}
    </div>
  );
}

function SectionList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-zinc-700">{title}</h3>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Pill key={`${title}-${value}`}>{value}</Pill>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">N/A</p>
      )}
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
    <article className="rounded-lg border border-zinc-200 p-3">
      <h3 className="text-sm font-medium text-zinc-800">{source}</h3>
      <div className="mt-2 space-y-1 text-xs text-zinc-500">
        <p>Scraped at: {scrapedLabel ?? "N/A"}</p>
        <p className="break-all">URL: {websiteUrl ?? "N/A"}</p>
      </div>
      {scrapeError ? <p className="mt-2 text-xs text-red-600">Error: {scrapeError}</p> : null}
      {scrapedDescription ? (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extracted description</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{scrapedDescription}</p>
        </div>
      ) : null}
      <div className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extracted URLs</h4>
        {extractedUrls.length > 0 ? (
          <ul className="mt-1 max-h-40 space-y-1 overflow-auto pr-1 text-sm">
            {extractedUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="block break-all text-zinc-700 underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">No URLs extracted from markdown.</p>
        )}
      </div>
      {contentMarkdown ? (
        <details className="mt-3 group">
          <p className="line-clamp-12 whitespace-pre-wrap text-sm leading-6 text-zinc-600 group-open:hidden">
            {contentMarkdown}
          </p>
          <summary className="cursor-pointer list-none text-sm font-medium text-zinc-700 underline-offset-2 hover:underline">
            <span className="group-open:hidden">Expand full snapshot</span>
            <span className="hidden group-open:inline">Collapse full snapshot</span>
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{contentMarkdown}</p>
        </details>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">No snapshot content.</p>
      )}
    </article>
  );
}

function extractUrlsFromMarkdown(markdown: string) {
  const markdownLinks = [...markdown.matchAll(/\[[^\]]*?\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);
  const bareUrls = [...markdown.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((match) => match[0]);
  const unique = new Set<string>();

  for (const rawUrl of [...markdownLinks, ...bareUrls]) {
    try {
      const normalized = new URL(rawUrl).toString();
      unique.add(normalized);
    } catch {
      // Skip malformed URLs.
    }
  }

  return [...unique].slice(0, 50);
}

function extractDescriptionFromMarkdown(markdown: string) {
  const withoutLinks = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
  const lines = withoutLinks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("- "))
    .filter((line) => !line.startsWith("* "))
    .filter((line) => !line.startsWith(">"))
    .filter((line) => !/^https?:\/\//.test(line));

  const chunks: string[] = [];
  let buffer = "";
  for (const line of lines) {
    const next = buffer ? `${buffer} ${line}` : line;
    if (next.length > 320) {
      if (buffer) {
        chunks.push(buffer);
      }
      buffer = line;
    } else {
      buffer = next;
    }
    if (chunks.length >= 2) {
      break;
    }
  }

  if (buffer && chunks.length < 2) {
    chunks.push(buffer);
  }

  return chunks.join("\n\n");
}
