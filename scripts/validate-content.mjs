#!/usr/bin/env node
/* Validates the manifest and any authored chapter MDX against it.
 * Structural manifest problems are ERRORS (exit 1).
 * Missing files / missing sections are WARNINGS (so it passes pre-fan-out).
 *
 *   node scripts/validate-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, "..", "content");
const manifest = JSON.parse(
  fs.readFileSync(path.join(contentDir, "_manifest.json"), "utf8")
);

const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

// ── Manifest integrity ────────────────────────────────
const bySlug = new Map();
for (const c of manifest) {
  if (bySlug.has(c.slug)) E(`duplicate slug: ${c.slug}`);
  bySlug.set(c.slug, c);
}

const hrefs = new Set();
const partOrder = new Set();
for (const c of manifest) {
  if (hrefs.has(c.href)) E(`duplicate href: ${c.href}`);
  hrefs.add(c.href);

  const k = `${c.part}/${c.order}`;
  if (partOrder.has(k)) E(`duplicate part/order ${k} (${c.slug})`);
  partOrder.add(k);

  const dir = c.part === "appendix" ? "appendix" : `part-${c.part}`;

  const expectHref = `/${dir}/${c.slug}`;
  if (c.href !== expectHref) E(`${c.slug}: href "${c.href}" should be "${expectHref}"`);

  const expectPath = `${dir}/${String(c.order).padStart(2, "0")}-${c.slug}.mdx`;
  if (c.path !== expectPath) E(`${c.slug}: path "${c.path}" should be "${expectPath}"`);

  for (const p of c.prerequisites || []) {
    if (!bySlug.has(p)) E(`${c.slug}: prerequisite "${p}" not in manifest`);
  }
  if (c.next !== null && !bySlug.has(c.next)) {
    E(`${c.slug}: next "${c.next}" not in manifest`);
  }
}

// ── Authored content checks ───────────────────────────
const REQUIRED = [
  { re: /<HeroCard/, label: "HeroCard" },
  { re: /<UnderTheHood|Under the Hood/, label: "an Under-the-Hood section" },
  { re: /<(ExecTimeline|ConceptGrid|BeforeAfter|QuickCheck|ChapterTabs)/, label: "at least one visual component" },
  { re: /<Lab\b/, label: "a <Lab> capture-the-flag (Lab Mandate)" },
  { re: /<Scoreboard\b/, label: "a <Scoreboard> panel" },
  { re: /<Recap/, label: "Recap" },
];

let authored = 0;
for (const c of manifest) {
  const fp = path.join(contentDir, c.path);
  if (!fs.existsSync(fp)) {
    W(`pending (not authored): ${c.path}`);
    continue;
  }
  authored++;
  const raw = fs.readFileSync(fp, "utf8");
  let parsed;
  try {
    parsed = matter(raw);
  } catch (e) {
    E(`${c.path}: frontmatter parse error — ${e.message}`);
    continue;
  }
  const fm = parsed.data;
  const body = parsed.content;

  // part may be a number (1/2/3) or the string "appendix" — compare as strings.
  if (String(fm.part) !== String(c.part)) E(`${c.path}: frontmatter part ${fm.part} != manifest ${c.part}`);
  if (Number(fm.order) !== c.order) E(`${c.path}: frontmatter order ${fm.order} != manifest ${c.order}`);
  if (fm.type !== c.type) E(`${c.path}: frontmatter type "${fm.type}" != manifest "${c.type}"`);
  if (!fm.title) E(`${c.path}: frontmatter missing title`);
  if (fm.title && fm.title !== c.title) W(`${c.path}: frontmatter title differs from manifest`);

  for (const r of REQUIRED) if (!r.re.test(body)) W(`${c.path}: missing ${r.label}`);

  const solutions = (body.match(/<Solution/g) || []).length;
  if (solutions < 3) W(`${c.path}: ${solutions} <Solution> block(s) — expect 3–5 exercises`);
}

// ── Report ────────────────────────────────────────────
console.log(
  `\nValidated ${manifest.length} manifest entries — ${authored} authored, ${manifest.length - authored} pending.`
);
if (warns.length) {
  console.log(`\n⚠  ${warns.length} warning(s):`);
  for (const w of warns) console.log("   - " + w);
}
if (errors.length) {
  console.log(`\n✖  ${errors.length} error(s):`);
  for (const e of errors) console.log("   - " + e);
  console.log("");
  process.exit(1);
}
console.log("\n✓  Manifest and authored content are structurally valid.\n");
