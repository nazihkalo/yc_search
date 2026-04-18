import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg italic tracking-tight text-foreground transition hover:text-primary"
          >
            yc search
          </Link>
          <div className="flex items-center gap-3">
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
  );
}
