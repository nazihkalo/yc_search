"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "./ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // The saved theme is only known on the client, so render both icons and
      // let the .dark class pick one; that keeps server and client HTML identical.
      aria-label="Toggle light and dark mode"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className="size-8 rounded-md text-muted-foreground hover:text-foreground"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
