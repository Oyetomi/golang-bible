#!/usr/bin/env node
/* Fast MDX compile-check for every authored chapter, in one pass.
 * Uses the same plugin stack as lib/content.ts so errors match the real build.
 * Much faster than `next build` for catching MDX syntax errors.
 *
 *   node scripts/lint-mdx.mjs            # all authored chapters
 *   node scripts/lint-mdx.mjs <file...>  # specific files
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, "..", "content");

const { compile } = await import(
  path.join(
    here,
    "..",
    "node_modules/.pnpm/@mdx-js+mdx@3.1.1/node_modules/@mdx-js/mdx/index.js"
  )
);
const remarkGfm = (await import("remark-gfm")).default;
const rehypeSlug = (await import("rehype-slug")).default;

let files = process.argv.slice(2);
if (!files.length) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(contentDir, "_manifest.json"), "utf8")
  );
  files = manifest
    .map((c) => path.join(contentDir, c.path))
    .filter((p) => fs.existsSync(p));
}

// Heuristic: a bare {lowercaseWord} in prose (outside fenced code, outside a
// quoted JSX attribute string) is evaluated by MDX as a JS identifier →
// "ReferenceError: x is not defined" at render. compile() doesn't catch it, so
// scan for it explicitly. Allows {1}, {true}, {[...]}, {{...}}, component exprs.
function bareBraceIdentifiers(content) {
  const hits = [];
  let inFence = false;
  let inBacktick = false; // inside a multi-line `...` template literal (JSX prop)
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // If we're mid template-literal, blank until a closing backtick (or whole line).
    if (inBacktick) {
      const close = line.indexOf("`");
      if (close === -1) continue; // whole line is inside the literal
      line = " ".repeat(close + 1) + line.slice(close + 1);
      inBacktick = false;
    }
    // Mask paired inline-code/strings, then detect an unclosed opening backtick.
    let masked = line
      .replace(/`[^`]*`/g, (m) => " ".repeat(m.length))
      .replace(/"[^"]*"/g, (m) => " ".repeat(m.length))
      .replace(/'[^']*'/g, (m) => " ".repeat(m.length));
    const open = masked.indexOf("`");
    if (open !== -1) {
      inBacktick = true; // a backtick opens and doesn't close on this line
      masked = masked.slice(0, open);
    }
    for (const m of masked.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)) {
      hits.push(`line ${i + 1}: {${m[1]}}`);
    }
  }
  return hits;
}

let failed = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const { content } = matter(raw);
  const braces = bareBraceIdentifiers(content);
  if (braces.length) {
    failed++;
    console.log(
      `✖ ${path.relative(contentDir, file)} — bare {identifier} in prose (wrap in backticks):\n    ` +
        braces.slice(0, 6).join("\n    ")
    );
    continue;
  }
  try {
    await compile(content, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    });
    console.log("✓ " + path.relative(contentDir, file));
  } catch (e) {
    failed++;
    const rel = path.relative(contentDir, file);
    const pos = e.line ? ` (line ${e.line}:${e.column})` : "";
    console.log(`✖ ${rel}${pos}\n    ${e.reason || e.message}`);
  }
}
console.log(
  `\n${files.length - failed}/${files.length} compiled${
    failed ? ` — ${failed} FAILED` : " — all clean"
  }.`
);
process.exit(failed ? 1 : 0);
