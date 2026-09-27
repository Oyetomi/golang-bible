import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import "../components/course/course.css";
import "../components/gamification/gamification.css";
import { AppShell } from "@/components/AppShell";

/* Editorial serif for display-scale headings only (chapter titles, section
   heads, the hero). Small UI headings use the body sans: see --font-display
   in globals.css. */
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
  fallback: ["ui-serif", "Georgia", "serif"],
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
  metadataBase: new URL("https://golangbible.dev"),
  title: {
    default: "The Go Bible — forged by the greatest Go engineer alive",
    template: "%s — The Go Bible",
  },
  description:
    "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "The Go Bible",
    description:
      "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
    url: "https://golangbible.dev",
    siteName: "The Go Bible",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/icon.svg",
        width: 128,
        height: 128,
        alt: "The Go Bible Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "The Go Bible",
    description:
      "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

/* Runs before first paint so a reader who chose dark never sees a flash of
   paper. Light is the default; the choice lives in localStorage "gb-theme". */
const themeScript = `try{if(localStorage.getItem("gb-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
