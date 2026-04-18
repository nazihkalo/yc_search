import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

import { Button } from "../ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/30 bg-background/60 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-ui-display)] text-xl italic tracking-tight text-foreground transition hover:text-primary"
        >
          yc search
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#tour" className="transition hover:text-foreground">Product tour</a>
          <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
            <UserButton
              appearance={{ elements: { avatarBox: "size-8 ring-1 ring-border/60" } }}
            />
          </Show>
        </div>
      </div>
    </header>
  );
}
