import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YC Search",
  description: "Search and semantically explore Y Combinator companies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
