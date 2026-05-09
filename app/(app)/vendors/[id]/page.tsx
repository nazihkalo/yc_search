import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, Globe2, Layers3 } from "lucide-react";

import { VendorLogo } from "../../../../components/vendor-logo";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { sourceLabel } from "../../../../lib/company-source";
import { getVendorDetail } from "../../../../lib/vendor-analytics";

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const vendorId = Number(id);
  if (!Number.isFinite(vendorId)) {
    notFound();
  }

  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard?tab=vendors";
  const detail = await getVendorDetail(vendorId);
  if (!detail) {
    notFound();
  }

  const { vendor, companies } = detail;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Button
        asChild
        type="button"
        variant="outline"
        className="rounded-full border-border/60 bg-background/60 backdrop-blur"
      >
        <Link href={safeReturnTo}>
          <ArrowLeft className="size-4" />
          Back to vendors
        </Link>
      </Button>

      <section className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <VendorLogo name={vendor.name} domain={vendor.domain} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{vendor.category}</Badge>
                {Object.entries(vendor.sourceCounts).map(([source, count]) => (
                  <Badge key={source} variant="muted">
                    {sourceLabel(source)} {count}
                  </Badge>
                ))}
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
                {vendor.name}
              </h1>
              {vendor.domain ? (
                <a
                  href={`https://${vendor.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
                >
                  <Globe2 className="size-4" />
                  {vendor.domain}
                  <ArrowUpRight className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-80">
            <StatTile
              icon={<Building2 className="size-4" />}
              label="Companies"
              value={vendor.companyCount}
            />
            <StatTile
              icon={<Layers3 className="size-4" />}
              label="Relationships"
              value={vendor.relationshipCount}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Companies using {vendor.name}</h2>
            <p className="text-sm text-muted-foreground">
              Each row is backed by trust, legal, privacy, security, or detected technology evidence.
            </p>
          </div>

          {companies.map((company) => (
            <Card key={company.id} className="border-border/60 bg-card/80">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/companies/${company.id}?returnTo=${encodeURIComponent(`/vendors/${vendor.id}`)}`}
                          className="font-semibold text-foreground transition hover:text-primary"
                        >
                          {company.name}
                        </Link>
                        <Badge variant="outline">{sourceLabel(company.sourceKind)}</Badge>
                        {company.sourceRank ? (
                          <Badge variant="muted">#{company.sourceRank}</Badge>
                        ) : null}
                      </div>
                      {company.oneLiner ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{company.oneLiner}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {company.industry ? <Badge variant="muted">{company.industry}</Badge> : null}
                        {company.batch ? <Badge variant="muted">{company.batch}</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                    {company.relationships.slice(0, 3).map((relationship) => (
                      <Badge
                        key={`${relationship.relationshipType}-${relationship.evidenceUrl ?? ""}`}
                        variant={relationship.relationshipType === "subprocessor" ? "default" : "secondary"}
                      >
                        {relationship.relationshipType.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {company.relationships.map((relationship) => (
                    <div
                      key={`${company.id}-${relationship.relationshipType}-${relationship.evidenceUrl ?? relationship.sourceType}`}
                      className="rounded-xl border border-border/50 bg-background/50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="muted">{relationship.category}</Badge>
                          <Badge variant="outline">{relationship.sourceType.replace(/_/g, " ")}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(relationship.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      {relationship.evidenceSnippet ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {relationship.evidenceSnippet}
                        </p>
                      ) : null}
                      {relationship.evidenceUrl ? (
                        <a
                          href={relationship.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Evidence
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Source coverage</CardTitle>
              <CardDescription>Distinct companies by source.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(vendor.sourceCounts).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{sourceLabel(source)}</span>
                  <span className="font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Relationship mix</CardTitle>
              <CardDescription>Evidence labels for this vendor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(vendor.relationshipTypeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{type.replace(/_/g, " ")}</span>
                  <span className="font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="size-11 shrink-0 rounded-xl border border-border/60 bg-background/70 object-cover"
      />
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-sm font-semibold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
