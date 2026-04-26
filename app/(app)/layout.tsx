import "@copilotkit/react-ui/styles.css";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { CopilotProvider } from "../../components/dashboard/copilot-provider";
import { ThemeToggle } from "../../components/theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur">
          <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              href="/dashboard"
              className="inline-flex items-baseline gap-0.5 text-lg font-semibold tracking-[-0.04em] text-foreground transition hover:text-primary"
            >
              yc<span className="text-primary">·</span>search
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-8 ring-1 ring-border/60",
                  },
                }}
              />
            </div>
          </div>
        </header>
        {children}
      </div>
    </CopilotProvider>
  );
}
