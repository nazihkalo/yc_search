import type { Metadata } from "next";
import { Manrope, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

import { AnalyticsProvider } from "../components/providers/analytics-provider";
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
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        // shadcn reads the app's CSS variables, so Clerk follows light/dark mode.
        baseTheme: shadcn,
        variables: {
          colorPrimary: "var(--foreground)",
          colorPrimaryForeground: "var(--background)",
          fontFamily: "var(--font-ui-sans)",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${sans.variable} ${mono.variable} ${display.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
          <AnalyticsProvider projectKey={process.env.POSTHOG_PROJECT_KEY || ""} host={process.env.POSTHOG_HOST || "https://us.i.posthog.com"} />
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
