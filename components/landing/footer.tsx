import Link from "next/link";

import { Wordmark } from "./marketing-nav";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <div className="flex flex-col gap-1">
          <Wordmark className="text-foreground" />
          <p className="text-xs">Independent project. Not affiliated with Y Combinator. Built on public YC data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/sign-in" className="transition hover:text-foreground">Sign in</Link>
          <Link href="/sign-up" className="transition hover:text-foreground">Sign up</Link>
          <a
            href="https://x.com/kalo_nazih"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Built by @kalo_nazih
          </a>
        </div>
      </div>
    </footer>
  );
}
