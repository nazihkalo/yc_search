import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="mt-12 border-t border-border/40">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div>
          <p className="text-lg font-semibold tracking-[-0.04em] text-foreground">
            yc<span className="text-primary">·</span>search
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground/80">
            Not affiliated with Y Combinator. Built on public YC data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/sign-in" className="transition hover:text-foreground">Sign in</Link>
          <Link href="/sign-up" className="transition hover:text-foreground">Sign up</Link>
          <span className="text-muted-foreground/80">
            Built by{" "}
            <a
              href="https://x.com/kalo_nazih"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground/90 transition hover:text-primary"
            >
              @kalo_nazih
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
