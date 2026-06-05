#!/usr/bin/env node
/* Builds public/search-index.json — a section-level full-text index of every
 * chapter, used by the client-side search modal. One entry per H2/H3 section
 * (plus an intro entry per chapter), each with a deep-link anchor that matches
 * rehype-slug's output, the heading text, and the stripped section body.
 *
 *   node scripts/build-search-index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, "..", "content");
const manifest = JSON.parse(
  fs.readFileSync(path.join(contentDir, "_manifest.json"), "utf8")
);

const MAX_TEXT = 1200; // chars of body kept per section

function stripInline(s) {
  return s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function stripBlock(s) {
  // remove fenced code blocks entirely
  s = s.replace(/```[\s\S]*?```/g, " ");
  // remove JSX tags (single- and multi-line)
  s = s.replace(/<[^>]*>/g, " ");
  // peel JSX expressions { ... } (a few passes for nesting)
  for (let i = 0; i < 5; i++) s = s.replace(/\{[^{}]*\}/g, " ");
  s = s.replace(/`([^`]*)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/^[#>\s]*[-*]?\s*/gm, " ");
  s = s.replace(/[*_~|`#>]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const index = [];
let id = 0;

for (const ch of manifest) {
  const fp = path.join(contentDir, ch.path);
  if (!fs.existsSync(fp)) continue;
  const { content } = matter(fs.readFileSync(fp, "utf8"));

  // Split into sections on H2/H3 headings (fence-aware).
  const slugger = new GithubSlugger();
  const lines = content.split("\n");
  let inFence = false;
  const sections = [];
  let cur = { heading: null, anchor: "", lines: [] };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      cur.lines.push(line);
      continue;
    }
    if (!inFence) {
      const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
      if (m) {
        sections.push(cur);
        const text = stripInline(m[2]);
        cur = { heading: text, anchor: slugger.slug(text), lines: [] };
        continue;
      }
    }
    cur.lines.push(line);
  }
  sections.push(cur);

  for (const s of sections) {
    const text = stripBlock(s.lines.join("\n")).slice(0, MAX_TEXT);
    if (!s.heading && !text) continue;
    index.push({
      id: id++,
      chTitle: ch.title,
      href: ch.href,
      part: ch.part,
      type: ch.type,
      heading: s.heading, // null for the intro section
      anchor: s.anchor, // '' for intro
      desc: s.heading ? undefined : ch.description,
      text,
    });
  }
}

const outDir = path.join(here, "..", "public");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "search-index.json");
fs.writeFileSync(outFile, JSON.stringify(index));
const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(
  `Search index: ${index.length} entries across ${manifest.length} chapters → public/search-index.json (${kb} KB)`
);
