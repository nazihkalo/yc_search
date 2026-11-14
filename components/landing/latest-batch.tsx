import { SignUpButton } from "@clerk/nextjs";

import { query } from "../../lib/db";
import { LogoTile } from "./logo-tile";

type Row = {
  id: number;
  name: string;
  one_liner: string | null;
  industry: string | null;
  small_logo_thumb_url: string | null;
  team_size: number | null;
  is_hiring: number | null;
};

async function getRows(batch: string): Promise<Row[]> {
  try {
    return await query<Row>(
      `SELECT id, name, one_liner, industry, small_logo_thumb_url, team_size, is_hiring
         FROM companies
        WHERE batch = @batch
          AND one_liner IS NOT NULL AND one_liner <> ''
        ORDER BY top_company DESC NULLS LAST, team_size DESC NULLS LAST, name ASC
        LIMIT 10`,
      { batch },
    );
  } catch {
    return [];
  }
}

export async function LatestBatch({ batch, total }: { batch: string | undefined; total: number }) {
  if (!batch) return null;
  const rows = await getRows(batch);
  if (rows.length === 0) return null;

  return (
    <section id="latest" className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl leading-tight tracking-[-0.01em] sm:text-5xl">{batch}</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              A few of the {total.toLocaleString("en-US")} companies in the latest full batch. In the app, every
              row opens founders, website, tech stack, and similar companies.
            </p>
          </div>
        </div>

        <ul className="mt-10 divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <li key={row.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-4 py-3.5 sm:grid-cols-[2.25rem_14rem_minmax(0,1fr)_9rem]">
              <LogoTile src={row.small_logo_thumb_url} name={row.name} />
              <span className="truncate font-medium">{row.name}</span>
              <span className="col-start-2 line-clamp-2 text-sm text-muted-foreground sm:col-start-auto sm:line-clamp-1">
                {row.one_liner}
              </span>
              <span className="col-start-2 mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:col-start-auto sm:mt-0 sm:justify-end">
                {row.industry ?? ""}
                {row.is_hiring ? <span className="text-primary">Hiring</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {rows.length} of {total.toLocaleString("en-US")}.
          </p>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-foreground/20 px-4 text-sm font-medium transition hover:border-foreground hover:bg-foreground hover:text-background"
            >
              See all of {batch}
            </button>
          </SignUpButton>
        </div>
      </div>
    </section>
  );
}
