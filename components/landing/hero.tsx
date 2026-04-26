import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

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

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 pb-12 pt-20 text-center sm:px-6 sm:pt-28 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3.5" />
          Free while in beta
        </span>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-7xl">
          Know who&apos;s already
          <br />
          building in your space.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Search every company YC has ever funded — by idea, batch, industry, or founder.
          Table, graph, and AI chat wired together so you stop guessing and start knowing.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Explore for free
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground/70">
          No credit card required &nbsp;·&nbsp; Free during beta
        </p>
      </div>
    </section>
  );
}
