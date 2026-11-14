import type { Overview } from "../../lib/overview";
import { LandingChatPrompt } from "./chat-prompt";

function n(value: number) {
  return value.toLocaleString("en-US");
}

export function Hero({ overview }: { overview: Overview }) {
  const firstYear = overview.years[0]?.year;
  const latestBatch = overview.recentBatchNames[0];
  const rising = overview.trendingTags.slice(0, 2).map((t) => t.name);

  const suggestions = [
    latestBatch ? `What is ${latestBatch} building?` : "What is the latest YC batch building?",
    rising[0] ? `Who's building in ${rising[0]}?` : "Who's building AI agents for finance?",
    "Has anyone built software for independent pharmacies?",
  ];

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.015em] text-foreground sm:text-6xl lg:text-[68px]">
          Every YC company, searchable by what it actually does.
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-8 text-muted-foreground">
          {overview.companies > 0 ? (
            <>
              <span className="text-foreground">{n(overview.companies)}</span> companies
              {overview.founders > 0 ? (
                <>
                  {" "}and <span className="text-foreground">{n(overview.founders)}</span> founders
                </>
              ) : null}{" "}
              from {overview.batchCount} batches{firstYear ? `, ${firstYear} to today` : ""}. Ask in plain
              English, or browse by batch, industry, and tag. Answers cite the actual companies.
            </>
          ) : (
            <>
              Every YC company and founder, from the first batch to today. Ask in plain English, or browse
              by batch, industry, and tag. Answers cite the actual companies.
            </>
          )}
        </p>
        {overview.hiring > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle" aria-hidden="true" />
            {n(overview.hiring)} of them are hiring right now.
          </p>
        ) : null}
      </div>

      <div className="lg:pt-3">
        <LandingChatPrompt suggestions={suggestions} />
      </div>
    </section>
  );
}
