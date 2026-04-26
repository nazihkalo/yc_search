import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { initializeDatabase, query, queryOne } from "../../lib/db";
import { Button } from "../ui/button";

type BatchRow = {
  id: number;
  slug: string | null;
  name: string;
  one_liner: string | null;
  industry: string | null;
  batch: string;
  small_logo_thumb_url: string | null;
};

type PreviewData = {
  batch: string;
  rowsInBatch: number;
  totalCompanies: number;
  rows: BatchRow[];
};

async function getPreview(): Promise<PreviewData | null> {
  try {
    await initializeDatabase();

    const latest = await queryOne<{ batch: string }>(
      `SELECT batch
         FROM companies
        WHERE batch IS NOT NULL
        GROUP BY batch
        ORDER BY MAX(COALESCE(launched_at, 0)) DESC
        LIMIT 1`,
    );
    if (!latest?.batch) return null;

    const [rows, batchCount, total] = await Promise.all([
      query<BatchRow>(
        `SELECT id, slug, name, one_liner, industry, batch, small_logo_thumb_url
           FROM companies
          WHERE batch = @batch
            AND one_liner IS NOT NULL
            AND small_logo_thumb_url IS NOT NULL
          ORDER BY top_company DESC NULLS LAST, launched_at DESC NULLS LAST
          LIMIT 8`,
        { batch: latest.batch },
      ),
      queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM companies WHERE batch = @batch`,
        { batch: latest.batch },
      ),
      queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM companies`),
    ]);

    if (rows.length === 0) return null;

    return {
      batch: latest.batch,
      rowsInBatch: Number(batchCount?.n ?? rows.length),
      totalCompanies: Number(total?.n ?? 0),
      rows,
    };
  } catch {
    return null;
  }
}

function formatTotal(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return n.toLocaleString();
}

export async function BatchPreview() {
  const data = await getPreview();
  if (!data) return null;

  const { batch, rowsInBatch, totalCompanies, rows } = data;

  return (
    <section
      id="preview"
      className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
          See what&apos;s inside
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
          Browse YC&apos;s latest batch — {batch}.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {rowsInBatch} companies just landed. Have a look, then sign up to search every batch
          back to 2005.
        </p>
      </div>

      <div className="relative mt-10 overflow-hidden rounded-3xl border border-border/50 bg-card/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border/40 bg-card/60 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">What they do</th>
                <th className="px-6 py-3 font-medium">Industry</th>
                <th className="px-6 py-3 font-medium">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i >= 6 ? "opacity-50" : "transition hover:bg-card/60"}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {row.small_logo_thumb_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.small_logo_thumb_url}
                          alt=""
                          className="size-9 shrink-0 rounded-lg border border-border/60 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-[10px] text-muted-foreground">
                          {row.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{row.name}</div>
                        {row.slug ? (
                          <div className="truncate text-xs text-muted-foreground">
                            ycombinator.com/companies/{row.slug}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="line-clamp-2 max-w-md">{row.one_liner}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{row.industry ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                      {row.batch}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-card via-card/85 to-transparent"
        />

        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            And {formatTotal(Math.max(totalCompanies - rows.length, 0))}+ more across every batch.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/sign-up">
              Sign up free to unlock the full search
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
