import fs from "fs";
import path from "path";
import { chapters, type Chapter } from "@/lib/manifest";

/* Per-lesson facts for the outline view, read from each chapter's MDX on the
   server: how long it takes to read, and the challenges in it, keyed exactly
   as the components record them (QuickCheck and PredictLab by their question
   text, Lab by its title), so the client can count what the reader has done. */

export type LessonFacts = {
  minutes: number;
  checks: string[]; // QuickCheck questions and PredictLab prompts
  labs: string[]; // Lab titles
};

function unescape(s: string) {
  return s.replace(/\\(["'\\`])/g, "$1");
}

function strings(src: string, prop: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `<${tag}\\b[^>]*?\\b${prop}=(?:"((?:[^"\\\\]|\\\\.)*)"|\\{\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')\\s*\\})`,
    "gs",
  );
  for (const m of src.matchAll(re)) out.push(unescape(m[1] ?? m[2] ?? m[3] ?? ""));
  return out;
}

let cache: Record<string, LessonFacts> | null = null;

export function lessonFacts(): Record<string, LessonFacts> {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const facts: Record<string, LessonFacts> = {};
  for (const c of chapters as Chapter[]) {
    let src = "";
    try {
      src = fs.readFileSync(path.join(process.cwd(), "content", c.path), "utf8");
    } catch {
      facts[c.slug] = { minutes: 0, checks: [], labs: [] };
      continue;
    }
    const prose = src.replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ");
    const words = prose.split(/\s+/).filter(Boolean).length;
    facts[c.slug] = {
      minutes: Math.max(3, Math.round(words / 180)),
      checks: [...strings(src, "question", "QuickCheck"), ...strings(src, "prompt", "PredictLab")],
      labs: strings(src, "title", "Lab"),
    };
  }
  cache = facts;
  return facts;
}
