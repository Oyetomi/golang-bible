import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Go Bible",
    short_name: "Go Bible",
    description:
      "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7ef",
    theme_color: "#0b1b38",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
