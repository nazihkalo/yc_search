import { SignUpButton } from "@clerk/nextjs";

const STEPS = [
  {
    title: "Start with a question or a batch",
    body: "Ask something like “who's building payroll for restaurants?”, or click a batch, industry, or tag in the sidebar to see who's in it.",
  },
  {
    title: "Open what looks interesting",
    body: "Answers come back as company and founder cards. Each one opens the full profile: what they do, who started it, their stack, and companies like it.",
  },
  {
    title: "Narrow it down",
    body: "Follow up in the chat (“only ones hiring”, “show it as a graph”) and the companies list updates next to the conversation.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-4xl leading-tight tracking-[-0.01em] sm:text-5xl">How it works</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t border-foreground pt-4">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-medium leading-snug">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 flex flex-col items-start justify-between gap-5 rounded-lg bg-foreground px-6 py-8 text-background sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="font-display text-3xl leading-tight">Free while it&apos;s in beta.</p>
            <p className="mt-1 text-sm text-background/70">No credit card. Takes about a minute.</p>
          </div>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:brightness-110"
            >
              Start exploring
            </button>
          </SignUpButton>
        </div>
      </div>
    </section>
  );
}
