import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="mt-12 border-t border-border/40">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div>
          <p className="font-[family-name:var(--font-ui-display)] text-lg italic tracking-tight text-foreground">
            yc search
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground/80">
            Not affiliated with Y Combinator. Public YC data, enriched with embeddings + Crawl4AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/sign-in" className="transition hover:text-foreground">Sign in</Link>
          <Link href="/sign-up" className="transition hover:text-foreground">Sign up</Link>
          <a
            href="https://github.com/yc-oss/api"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Data source
          </a>
        </div>
      </div>
    </footer>
  );
}
