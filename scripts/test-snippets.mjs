import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const CONTENT_DIR = "content";
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
const goModPath = path.join(tmpDir, "go.mod");
fs.writeFileSync(goModPath, "module snippettest\n\ngo 1.24\n");

console.log(`[test-snippets] Scratchpad directory: ${tmpDir}`);
console.log(`[test-snippets] Mode: ${REPORT_ONLY ? "REPORT ONLY (non-blocking)" : "STRICT (blocking)"}`);

const files = getMdxFiles(CONTENT_DIR);
let totalSnippets = 0;
let totalPackageMain = 0;
let skippedCount = 0;
let passedCount = 0;
let failedSnippets = [];

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

        // Test compilation
        const snippetFile = path.join(tmpDir, "main.go");
        fs.writeFileSync(snippetFile, code);

        try {
          execSync("go build -o /dev/null main.go", {
            cwd: tmpDir,
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 5000,
          });
          passedCount++;
        } catch (err) {
          const stderr = err.stderr ? err.stderr.toString() : err.message;
          const detail = stderr
            .split("\n")
            .filter((l) => l.trim() && !l.startsWith("#"))[0];
          failedSnippets.push({
            file,
            line: startLine,
            error: detail || "compile error",
          });
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
console.log("            GO SNIPPET COMPILATION BASELINE            ");
console.log("=======================================================");
console.log(`Total Go snippets found:          ${totalSnippets}`);
console.log(`Standalone (package main):        ${totalPackageMain}`);
console.log(`Fragments (functions/structs):    ${totalSnippets - totalPackageMain} (not standalone)`);
console.log(`Skipped (intentional/anti-pat):   ${skippedCount}`);
console.log(`Passed 'go build':                ${passedCount}`);
console.log(`Failed 'go build':                ${failedSnippets.length}`);
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

if (!REPORT_ONLY && failedSnippets.length > 0) {
  console.error(`\n[FATAL] ${failedSnippets.length} snippets failed compilation.`);
  process.exit(1);
} else {
  console.log(`\nBaseline established successfully.`);
  process.exit(0);
}
