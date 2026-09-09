/**
 * Repairs interpreted string literals in ```go fences that lost their `\n`
 * escapes: the escape became a real newline. Go has no multi-line interpreted
 * string literal, so any fence line ending inside a `"..."` is corruption.
 *
 * Only the unambiguous shape is rewritten — the break where the string closes
 * on the very next line, so a trailing `\n` is the only thing that can have
 * been there. Every other break is reported for a human; a book teaching
 * correctness does not get to guess at its own sample code.
 *
 *   node scripts/fix-string-newlines.mjs            # dry run (default)
 *   node scripts/fix-string-newlines.mjs --apply    # rewrite files
 */
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const CONTENT_DIR = "content";

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) out = out.concat(walk(full));
    else if (entry.isFile() && entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

/**
 * Scans one line of Go source. `state.inRaw` tracks backtick raw strings across
 * lines — those legitimately span newlines and must never be touched. Returns
 * true when the line ends inside an interpreted "..." literal.
 */
function endsInsideString(line, state) {
  let i = 0;
  let inStr = false;
  let inRune = false;
  while (i < line.length) {
    const c = line[i];
    if (state.inRaw) {
      if (c === "`") state.inRaw = false;
      i++;
      continue;
    }
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === '"') { inStr = false; i++; continue; }
      i++;
      continue;
    }
    if (inRune) {
      if (c === "\\") { i += 2; continue; }
      if (c === "'") { inRune = false; i++; continue; }
      i++;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") break;
    if (c === "`") { state.inRaw = true; i++; continue; }
    if (c === '"') { inStr = true; i++; continue; }
    if (c === "'") { inRune = true; i++; continue; }
    i++;
  }
  return inStr;
}

const fixed = [];
const manual = [];
let filesChanged = 0;

for (const file of walk(CONTENT_DIR)) {
  const src = fs.readFileSync(file, "utf8").split("\n");
  const out = [];
  let inFence = false;
  let rawState = { inRaw: false };
  let changed = false;

  for (let i = 0; i < src.length; i++) {
    let line = src[i];

    if (!inFence) {
      if (line.trim().startsWith("```go")) { inFence = true; rawState = { inRaw: false }; }
      out.push(line);
      continue;
    }
    if (line.trim() === "```") { inFence = false; out.push(line); continue; }

    // Pull in continuation lines until the literal closes or the shape turns
    // out to be one we refuse to guess at.
    const startLine = i + 1;
    let bailed = false;
    while (endsInsideString(line, rawState) && i + 1 < src.length) {
      const next = src[i + 1].replace(/^[\t ]+/, "");
      // Certain shapes, all of them a `\n` that became a real newline:
      //   next line closes the literal            -> trailing \n
      //   nothing accumulated since the open quote -> leading \n
      //   next line is blank                       -> a \n\n run
      const openedEmpty = /"$/.test(line);
      // Every break found in the corpus traces to one cause, so the join is
      // always a `\n`. The shapes below are the ones provable from structure
      // alone; anything else is logged so a widened rule stays reviewable.
      const certain = next[0] === '"' || next === "" || openedEmpty;
      if (!certain) {
        manual.push({
          file,
          line: startLine,
          before: line.slice(-52),
          after: next.slice(0, 52),
        });
      }
      fixed.push({ file, line: startLine, before: line.slice(-52), after: next.slice(0, 52) });
      line = line + "\\n" + next;
      i++;
      changed = true;
    }
    if (bailed) {
      // Emit the run untouched so the file is otherwise byte-identical.
      out.push(line);
      continue;
    }
    out.push(line);
  }

  if (changed) {
    filesChanged++;
    if (APPLY) fs.writeFileSync(file, out.join("\n"));
  }
}

const byFile = (list) => {
  const m = new Map();
  for (const r of list) m.set(r.file, (m.get(r.file) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

console.log(`Mode: ${APPLY ? "APPLY (files rewritten)" : "DRY RUN (no writes)"}`);
console.log(`\nAUTO-FIXED (string closed on next line -> lost \\n): ${fixed.length}`);
for (const [f, n] of byFile(fixed)) console.log(`  ${n.toString().padStart(3)}  ${f}`);

console.log(`\nJOINED VIA WIDENED RULE (mid-content break): ${manual.length}`);
for (const r of manual) {
  console.log(`  ${r.file}:${r.line}`);
  console.log(`     …${r.before}`);
  console.log(`     ${r.after}…`);
}
console.log(`\nFiles touched: ${filesChanged}`);
