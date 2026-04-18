import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "../ui/button";

const FREE_FEATURES = [
  "Unlimited keyword + semantic search",
  "Full company + founder detail pages",
  "3D similarity graph",
  "Ask-YC chat",
  "Analytics dashboard",
];

const PRO_FEATURES = [
  "Saved searches + alerts",
  "CSV exports",
  "API access",
  "Batch change notifications",
  "Priority Ask-YC chat",
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Pricing</p>
        <h2 className="mt-3 font-[family-name:var(--font-ui-display)] text-4xl italic tracking-tight text-foreground sm:text-5xl">
          Free while we&apos;re in beta.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Sign up today, use everything. Pro tier is in the works for teams who need exports, alerts,
          and API access.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-card/60 p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-2xl font-semibold text-foreground">Beta access</h3>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                Now
              </span>
            </div>
            <p className="mt-2 font-[family-name:var(--font-ui-display)] text-5xl italic tracking-tight text-foreground">
              Free
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything, no limits. Just sign up.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm">
              {FREE_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-foreground/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" className="mt-8 w-full rounded-full">
              <Link href="/sign-up">
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-2xl font-semibold text-foreground">Pro</h3>
            <span className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-ui-display)] text-5xl italic tracking-tight text-muted-foreground">
            $—
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            For teams, researchers, and heavy users.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm">
            {PRO_FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Button
            disabled
            size="lg"
            variant="outline"
            className="mt-8 w-full rounded-full"
          >
            Pro — coming soon
          </Button>
        </div>
      </div>
    </section>
  );
}
