import type { MetadataRoute } from "next";
import { chapters } from "@/lib/manifest";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://golangbible.dev";

  const chapterEntries: MetadataRoute.Sitemap = chapters.map((c) => ({
    url: `${baseUrl}${c.href}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: c.order === 1 ? 0.9 : 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...chapterEntries,
  ];
}
