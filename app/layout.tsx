import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "../components/providers/theme-provider";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-ui-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-ui-mono",
});

export const metadata: Metadata = {
  title: "YC Search",
  description: "Modern semantic search, analytics, and Crawl4AI context for Y Combinator companies.",
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
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${sans.variable} ${mono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
