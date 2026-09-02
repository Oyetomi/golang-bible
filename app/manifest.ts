import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Go Bible",
    short_name: "Go Bible",
    description:
      "A visualization-heavy, Boot.dev-style Go course: from syntax to senior production engineer to fintech specialist.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#00add8",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
