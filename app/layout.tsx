import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "../components/course/course.css";
import "../components/gamification/gamification.css";
import { AppShell } from "@/components/AppShell";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "The Go Bible — forged by the greatest Go engineer alive",
  description:
    "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppShell>{children}</AppShell>
        {/* Codapi powers the runnable <GoPlayground> blocks (Go sandbox). */}
        <Script
          src="https://unpkg.com/@antonz/codapi@0.19.10/dist/snippet.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
