"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";

import { ThemeToggle } from "../theme-toggle";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-[17px] font-semibold tracking-[-0.03em] ${className}`}>
      yc<span className="px-[1px] text-primary">/</span>search
    </span>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-foreground" aria-label="yc search home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Page sections">
          <a href="#data" className="transition hover:text-foreground">The data</a>
          <a href="#latest" className="transition hover:text-foreground">Latest batch</a>
          <a href="#how" className="transition hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="h-8 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="h-8 rounded-md bg-foreground px-3 text-sm font-medium text-background transition hover:bg-primary"
              >
                Get started
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition hover:bg-primary"
            >
              Open app
            </Link>
          </Show>
        </div>
      </div>
    </header>
  );
}
