import {
  BarChart3,
  Bot,
  GitBranch,
  MessageSquareText,
  Network,
  Search,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";

const WORKFLOWS = [
  {
    icon: Search,
    title: "Find companies from a rough idea",
    body:
      "Ask for a space in plain English and get a table you can filter by batch, market, status, and similarity.",
    preview: ["AI agents for healthcare billing", "37 matched companies", "Sort by newest batch"],
  },
  {
    icon: Network,
    title: "Map the category around them",
    body:
      "Move from a company to its neighborhood: adjacent startups, clusters, and gaps that are hard to see in a list.",
    preview: ["Developer infra", "Data movement", "Model deployment"],
  },
  {
    icon: Users,
    title: "Trace founder and hiring signals",
    body:
      "Open company profiles with founders, links, GitHub context, and public website snapshots in one flow.",
    preview: ["Prior operator", "OSS maintainer", "Hiring engineers"],
  },
  {
    icon: Tags,
    title: "Spot vendor and stack patterns",
    body:
      "Use enriched website data to see what tools, integrations, and platforms appear across a startup set.",
    preview: ["Postgres", "Stripe", "OpenAI", "Vercel"],
  },
  {
    icon: BarChart3,
    title: "Compare momentum by batch",
    body:
      "See whether a market is getting denser, cooling off, or splitting into new subcategories over time.",
    preview: ["Spring 2026 spike", "8 batches", "Hiring trend"],
  },
  {
    icon: MessageSquareText,
    title: "Turn results into the next prompt",
    body:
      "Keep the research thread alive by asking follow-ups against the table, founders, vendors, or map.",
    preview: ["Only hiring", "Show founder links", "Open vendor overlap"],
  },
];

const CARD_LAYOUT = [
  "lg:col-span-6",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-4",
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
            Research workflows
          </p>
          <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Go from question to company intelligence.
          </h2>
        </div>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
          YC Search is built for exploration loops: ask, inspect, branch, compare, and return to
          the chat with a sharper question.
        </p>
      </div>

      <div className="mt-12 grid gap-3 lg:grid-cols-12 lg:auto-rows-fr">
        {WORKFLOWS.map((workflow, index) => (
          <article
            key={workflow.title}
            className={[
              "flex flex-col rounded-lg border border-border/55 bg-card/55 p-5",
              CARD_LAYOUT[index],
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                <workflow.icon className="size-4" />
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                {workflow.title}
              </h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{workflow.body}</p>

            {index === 0 ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  ["Company", "HealthBill AI"],
                  ["Batch", "S24"],
                  ["Signal", "Provider ops"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-border/45 bg-background/55 px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-xs font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              {workflow.preview.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-md border border-border/45 bg-background/55 px-3 py-2 text-xs text-muted-foreground"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {index === 1 ? (
              <div className="mt-4 rounded-md border border-border/45 bg-background/55 p-3">
                <div className="flex h-24 items-center justify-center">
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-primary/15 px-3 py-2 text-primary">Core</span>
                    <span className="rounded-md bg-chart-2/15 px-3 py-2 text-chart-2">Adjacent</span>
                    <span className="rounded-md bg-chart-3/15 px-3 py-2 text-chart-3">Gap</span>
                    <span className="col-span-2 rounded-md bg-muted px-3 py-2">42 companies</span>
                    <span className="rounded-md bg-muted px-3 py-2">8 batches</span>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border/55 bg-background/65 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/12 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Chat is the control surface.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tables, cards, graphs, and profile panels are generated from the same research thread.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitBranch className="size-4 text-primary" />
            <span>Ask, filter, branch, compare</span>
          </div>
        </div>
      </div>
    </section>
  );
}
