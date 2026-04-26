import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

import { StorePendingQuestion } from "../../../components/auth/store-pending-question";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <Suspense fallback={null}>
        <StorePendingQuestion />
      </Suspense>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[680px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 size-[420px] rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative">
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card/80 border border-border/60 shadow-xl shadow-black/30 backdrop-blur",
              headerTitle: "font-semibold tracking-[-0.03em]",
            },
          }}
        />
      </div>
    </div>
  );
}
