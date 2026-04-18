import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "../ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 size-[540px] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3.5" />
          Free while in beta
        </span>

        <h1 className="mt-6 max-w-4xl font-[family-name:var(--font-ui-display)] text-5xl leading-[1.02] tracking-tight text-foreground sm:text-7xl">
          Search every YC company.
          <span className="block italic text-primary/90">Semantically.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Hybrid keyword and embedding search across every Y Combinator batch, with founder
          enrichment, 3D similarity graphs, and AI-grounded Q&amp;A over the actual company pages.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
            <Link href="/sign-up">
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-full px-6 text-base"
          >
            <Link href="#tour">Watch product tour</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground/80">
          No credit card. Sign up with Google, GitHub, or email.
        </p>
      </div>
    </section>
  );
}
