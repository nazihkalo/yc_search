import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[680px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 size-[420px] rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card/80 border border-border/60 shadow-xl shadow-black/30 backdrop-blur",
              headerTitle: "font-[family-name:var(--font-ui-display)] italic",
            },
          }}
        />
      </div>
    </div>
  );
}
