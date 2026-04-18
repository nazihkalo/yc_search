import Link from "next/link";

import { badgeStyleFor } from "../../../lib/colors";
import { getSimilarCompanies } from "../../../lib/company-details";
import { Badge } from "../../../components/ui/badge";

export async function SimilarCompaniesPanel({ companyId }: { companyId: number }) {
  const similar = await getSimilarCompanies(companyId, 8);

  if (similar.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-sm text-muted-foreground">
        No embedding-based matches available yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {similar.map((item) => (
        <Link
          key={item.id}
          href={`/companies/${item.id}`}
          className="group block rounded-2xl border border-border/60 bg-background/50 p-4 transition hover:-translate-y-[1px] hover:border-primary/40 hover:bg-background/80 hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{item.name}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {item.one_liner ?? "No one-liner available."}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.batch ? (
                  <Badge
                    variant="tinted"
                    className="border"
                    style={badgeStyleFor(`batch:${item.batch}`)}
                  >
                    {item.batch}
                  </Badge>
                ) : null}
                {item.industry ? (
                  <Badge
                    variant="tinted"
                    className="border"
                    style={badgeStyleFor(`ind:${item.industry}`)}
                  >
                    {item.industry}
                  </Badge>
                ) : null}
                {item.stage ? (
                  <Badge variant="secondary">{item.stage}</Badge>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="font-mono text-xs tracking-tight text-muted-foreground">
                {item.similarity.toFixed(3)}
              </span>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                sim
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function SimilarCompaniesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-border/60 bg-background/40"
        />
      ))}
    </div>
  );
}
