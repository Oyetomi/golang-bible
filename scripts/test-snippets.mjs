import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const CONTENT_DIR = "content";
// The corpus targets this Go release; GOTOOLCHAIN=auto fetches it when the
// local toolchain is older. Bump here and in the README badge together.
const GO_VERSION = "1.26";
const WITH_MODULES = process.argv.includes("--with-modules");
// `go vet` implies a compile, so this replaces the build rather than adding a
// pass. Anti-pattern chapters and `noverify` blocks are already excluded, which
// is what keeps vet from firing on the mistakes the book sets out to teach.
const VET = process.argv.includes("--vet");

/**
 * Import paths declared by a snippet — only the ones inside an `import` clause.
 * Matching every quoted string instead would sweep in ordinary data (a URL, a
 * file path, a sentence) and mistake it for a dependency.
 */
export function importPaths(code) {
  const paths = [];
  for (const group of code.matchAll(/^[ \t]*import\s*\(([\s\S]*?)^[ \t]*\)/gm)) {
    for (const line of group[1].split("\n")) {
      const single = line.match(/^\s*(?:[\w.]+\s+)?"([^"]+)"/);
      if (single) paths.push(single[1]);
    }
  }
  for (const single of code.matchAll(/^[ \t]*import\s+(?:[\w.]+\s+)?"([^"]+)"/gm)) {
    paths.push(single[1]);
  }
  return paths;
}

/**
 * True when a snippet imports anything outside the standard library. Stdlib
 * import paths never carry a dot in their first segment, so `github.com/...`,
 * `golang.org/x/...` and `entgo.io/...` all separate cleanly from `net/http`.
 * These snippets need the module proxy, so they build in their own tier rather
 * than blocking a hermetic run.
 */
function needsModules(code) {
  return importPaths(code).some((p) => p.split("/")[0].includes("."));
}
const REPORT_ONLY = process.argv.includes("--report-only") || !process.argv.includes("--strict");

// Scan all .mdx files
function getMdxFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      files = files.concat(getMdxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }
  return files;
}

// Temporary directory for builds
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gb-snippet-test-"));
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "snippet-fixtures");

if (WITH_MODULES) {
  // The fixture module pins every third-party dependency the corpus imports,
  // so a snippet builds against a known version rather than whatever the proxy
  // serves today. Its own go directive may exceed GO_VERSION when a dependency
  // demands a newer release; that governs the dependency build, not the book.
  fs.copyFileSync(path.join(FIXTURES, "go.mod"), path.join(tmpDir, "go.mod"));
  fs.copyFileSync(path.join(FIXTURES, "go.sum"), path.join(tmpDir, "go.sum"));
} else {
  fs.writeFileSync(path.join(tmpDir, "go.mod"), `module snippettest\n\ngo ${GO_VERSION}\n`);
}

console.log(`[test-snippets] Scratchpad directory: ${tmpDir}`);
console.log(`[test-snippets] Mode: ${REPORT_ONLY ? "REPORT ONLY (non-blocking)" : "STRICT (blocking)"}`);

// The first snippet of a run would otherwise absorb the cost of populating a
// cold build cache — on a fresh CI runner that alone can exceed a per-snippet
// timeout, and the failure then points at whichever chapter happened to sort
// first. Pay it once, here, where it belongs to nobody's snippet.
try {
  fs.writeFileSync(path.join(tmpDir, "main.go"), "package main\n\nfunc main() {}\n");
  execSync(VET ? "go vet main.go" : "go build -o /dev/null main.go", {
    cwd: tmpDir,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });
  console.log("[test-snippets] build cache warmed");
} catch {
  console.log("[test-snippets] cache warm-up skipped");
}

const files = getMdxFiles(CONTENT_DIR);
let totalSnippets = 0;
let totalPackageMain = 0;
let skippedCount = 0;
let passedCount = 0;
let moduleTierCount = 0;
let failedSnippets = [];
let moduleTierFailures = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  let inGoBlock = false;
  let blockLines = [];
  let startLine = 0;
  let blockMeta = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inGoBlock && line.trim().startsWith("```go")) {
      inGoBlock = true;
      startLine = i + 1;
      blockMeta = line.trim().slice(5).trim();
      blockLines = [];
      continue;
    }

    if (inGoBlock && line.trim() === "```") {
      inGoBlock = false;
      totalSnippets++;

      const code = blockLines.join("\n");

      // A standalone program needs both the clause and an entry point. Snippets
      // that carry `package main` but define only helpers belong to a larger
      // chapter-scoped program and cannot be built on their own.
      if (code.includes("package main") && /func\s+main\s*\(/.test(code)) {
        totalPackageMain++;

        // Check for intentional failure / noverify escapes
        const isSkipped =
          blockMeta.includes("noverify") ||
          blockMeta.includes("bad") ||
          blockMeta.includes("wrong") ||
          code.includes("// bible:noverify") ||
          code.includes("// bible:expect-fail") ||
          code.includes("// BAD:") ||
          code.includes("// WRONG:") ||
          file.includes("mistakes-"); // Appendix 13-18 are anti-pattern chapters

        if (isSkipped) {
          skippedCount++;
          continue;
        }

        // `novet` exempts a snippet from vet only — a chapter that teaches what
        // vet catches has to be able to show code vet rejects, while still
        // proving that code compiles.
        if (VET && (blockMeta.includes("novet") || code.includes("// bible:novet"))) {
          skippedCount++;
          continue;
        }

        const thirdParty = needsModules(code);
        if (thirdParty && !WITH_MODULES) {
          moduleTierCount++;
          continue;
        }

        // Test compilation
        const snippetFile = path.join(tmpDir, "main.go");
        fs.writeFileSync(snippetFile, code);

        try {
          execSync(VET ? "go vet main.go" : "go build -o /dev/null main.go", {
            cwd: tmpDir,
            stdio: ["ignore", "pipe", "pipe"],
            // A stdlib build is quick, but a snippet pulling a large dependency
            // tree can exceed a short budget on a cold module cache and get
            // reported as a compile failure it is not.
            timeout: thirdParty ? 120000 : 60000,
          });
          passedCount++;
        } catch (err) {
          const stderr = err.stderr ? err.stderr.toString() : err.message;
          const timedOut = err.killed === true || err.signal === "SIGTERM";
          const detail = timedOut
            ? `timed out after ${thirdParty ? 120 : 60}s (not a compile failure)`
            : stderr
                .split("\n")
                .filter((l) => l.trim() && !l.startsWith("#"))[0];
          const failure = { file, line: startLine, error: detail || "compile error" };
          if (thirdParty) moduleTierFailures.push(failure);
          else failedSnippets.push(failure);
        }
      }
      continue;
    }

    if (inGoBlock) {
      blockLines.push(line);
    }
  }
}

// Clean up scratchpad
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("\n=======================================================");
console.log("            GO SNIPPET VERIFICATION BASELINE           ");
console.log("=======================================================");
console.log(`Total Go snippets found:          ${totalSnippets}`);
console.log(`Standalone (package main):        ${totalPackageMain}`);
console.log(`Fragments (functions/structs):    ${totalSnippets - totalPackageMain} (not standalone)`);
console.log(`Skipped (intentional/anti-pat):   ${skippedCount}`);
console.log(
  WITH_MODULES
    ? `Third-party tier (built):         ${moduleTierFailures.length} failed`
    : `Third-party tier (deferred):      ${moduleTierCount} (run --with-modules)`
);
console.log(`Passed:                           ${passedCount}`);
console.log(`Failed:                           ${failedSnippets.length}`);
console.log("=======================================================\n");

if (failedSnippets.length > 0) {
  console.log("Failed Snippets Breakdown (First 20):");
  for (const f of failedSnippets.slice(0, 20)) {
    console.log(`  • ${f.file}:${f.line} -> ${f.error}`);
  }
  if (failedSnippets.length > 20) {
    console.log(`  ... and ${failedSnippets.length - 20} more failures.`);
  }
}

if (WITH_MODULES && moduleTierFailures.length > 0) {
  console.log(`\nThird-party tier failures${REPORT_ONLY ? " (reporting only)" : ""}:`);
  for (const f of moduleTierFailures.slice(0, 20)) {
    console.log(`  • ${f.file}:${f.line} -> ${f.error}`);
  }
  if (moduleTierFailures.length > 20) {
    console.log(`  ... and ${moduleTierFailures.length - 20} more.`);
  }
}

const blocking = failedSnippets.length + (WITH_MODULES ? moduleTierFailures.length : 0);
if (!REPORT_ONLY && blocking > 0) {
  console.error(`\n[FATAL] ${blocking} snippets failed ${VET ? "go vet" : "compilation"}.`);
  process.exit(1);
} else {
  console.log(`\nBaseline established successfully.`);
  process.exit(0);
}
