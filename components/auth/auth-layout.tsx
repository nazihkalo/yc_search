import Link from "next/link";

import { getOverview } from "../../lib/overview";
import { Wordmark } from "../landing/marketing-nav";
import { PendingQuestionNote } from "./pending-question-note";

export async function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const overview = await getOverview();

  const facts =
    overview.companies > 0
      ? [
          `${overview.companies.toLocaleString("en-US")} companies across ${overview.batchCount} batches`,
          overview.founders > 0 ? `${overview.founders.toLocaleString("en-US")} founder profiles` : null,
          overview.hiring > 0 ? `${overview.hiring.toLocaleString("en-US")} companies hiring now` : null,
          "Updated every night from YC's public directory",
        ].filter((fact): fact is string => Boolean(fact))
      : ["Every YC company and founder", "Updated every night from YC's public directory"];

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r border-border bg-card px-10 py-10 lg:flex xl:px-16">
        <Link href="/" className="text-foreground" aria-label="yc search home">
          <Wordmark />
        </Link>
        <div className="max-w-md">
          <p className="font-display text-5xl leading-[1.05] tracking-[-0.01em]">
            Find out who&apos;s already building it.
          </p>
          <ul className="mt-8 space-y-3 border-t border-border pt-6 text-[15px] text-muted-foreground">
            {facts.map((fact) => (
              <li key={fact} className="flex items-baseline gap-3">
                <span className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-primary" aria-hidden="true" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Not affiliated with Y Combinator.</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="text-foreground lg:hidden" aria-label="yc search home">
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-4xl leading-tight tracking-[-0.01em]">{title}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
          <PendingQuestionNote />
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Strip Clerk's own card chrome so the form sits directly on the page. */
export const authAppearance = {
  elements: {
    rootBox: "w-full! max-w-none!",
    cardBox: "w-full! max-w-none! shadow-none! border-0! rounded-none! bg-transparent!",
    card: "w-full! max-w-none! bg-transparent! shadow-none! border-0! px-0! pt-0! pb-2!",
    main: "w-full!",
    header: "hidden!",
    footer: "bg-transparent! border-0! shadow-none! [&>div]:bg-transparent! [&>div]:px-0!",
    footerAction: "justify-start! px-0!",
    formButtonPrimary: "h-10 text-sm font-medium shadow-none!",
    socialButtonsBlockButton: "h-10 shadow-none!",
    formFieldInput: "h-10 shadow-none!",
  },
};
