import data from "@/content/_manifest.json";

export type Part = 1 | 2 | 3 | 4 | "appendix";

export type Chapter = {
  slug: string;
  title: string;
  part: Part;
  order: number;
  type: "course" | "project";
  description: string;
  prerequisites: string[];
  next: string | null;
  path: string;
  href: string;
  heavy?: boolean;
  // Tracks group lessons into numbered modules ("Building the Store"), and
  // mark practice lessons: a workshop builds something, a sidequest is an
  // optional challenge.
  module?: string;
  kind?: "lesson" | "workshop" | "sidequest";
};

export const chapters = data as Chapter[];

export const PART_ORDER: Part[] = [1, 2, 3, 4, "appendix"];

export const PART_TITLES: Record<string, string> = {
  "1": "The Language",
  "2": "Becoming a Badass Go Engineer",
  "3": "Fintech in Go",
  "4": "Infrastructure",
  appendix: "DS&A & Coding Interviews",
};

export const PART_SUBTITLES: Record<string, string> = {
  "1": "Zero to Backend",
  "2": "Production-grade engineering",
  "3": "The domain capstone",
  "4": "From process to platform",
  appendix: "Optional interview-prep track",
};

export function partLabel(part: Part): string {
  return part === "appendix" ? "Appendix" : `Part ${part}`;
}

export function partDir(part: Part): string {
  return part === "appendix" ? "appendix" : `part-${part}`;
}

export function chapterByHref(href: string): Chapter | undefined {
  return chapters.find((c) => c.href === href);
}

export function chapterBySlug(slug: string): Chapter | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function partGroups() {
  return PART_ORDER.map((p) => ({
    part: p,
    label: partLabel(p),
    title: PART_TITLES[String(p)],
    subtitle: PART_SUBTITLES[String(p)],
    chapters: chapters
      .filter((c) => c.part === p)
      .sort((a, b) => a.order - b.order),
  }));
}
