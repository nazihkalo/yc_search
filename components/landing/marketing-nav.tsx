"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";

import { Button } from "../ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/30 bg-background/60 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-baseline gap-0.5 text-xl font-semibold tracking-[-0.04em] text-foreground transition hover:text-primary"
        >
          yc<span className="text-primary">·</span>search
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#preview" className="transition hover:text-foreground">Product</a>
          <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" className="rounded-full">Start free</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </Show>
        </div>
      </div>
    </header>
  );
}
