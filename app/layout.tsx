import type { Metadata } from "next";
import { Manrope, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

import { ThemeProvider } from "../components/providers/theme-provider";
import { TooltipProvider } from "../components/ui/tooltip";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-ui-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-ui-mono",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-ui-display",
});

export const metadata: Metadata = {
  title: "YC Search",
  description: "Search every YC company in seconds. Find out who's already building in your space across 20 years of Y Combinator batches.",
  icons: {
    icon: "/logos/yc_search_logo.svg",
    apple: "/logos/yc_search_logo.svg",
    shortcut: "/logos/yc_search_logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "oklch(0.72 0.18 60)",
          fontFamily: "var(--font-ui-sans)",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning className="dark">
        <body className={`${sans.variable} ${mono.variable} ${display.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
