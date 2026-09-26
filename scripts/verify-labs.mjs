// verify-labs: every self-check <Lab> must be honest.
//
// For each <Lab verify="self-check" expect="..."> in content/, extract the
// starter (a JS template literal, evaluated exactly as the site does), build
// and run it, and fail if the starter ALREADY prints the expect sentinel:
// a lab whose broken starter passes can be "solved" without doing anything.
// A starter that doesn't build is fine (and often intended: main calls an API
// the reader has to write).
//
// This can't prove the intended fix passes (that needs a reference solution),
// but it catches the cheapest failure: a harness that checks nothing. Each
// starter runs RUNS times (--runs N, default 3), because a check that depends
// on timing (a deadlock that only USUALLY happens) can let a broken starter
// pass now and then.
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const CONTENT = "content";
const runsArg = process.argv.indexOf("--runs");
const RUNS = runsArg > 0 ? Number(process.argv[runsArg + 1]) : 3;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".mdx")) files.push(p);
  }
})(CONTENT);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gb-labs-"));
fs.writeFileSync(path.join(tmp, "go.mod"), "module lab\n\ngo 1.27\n");

let checked = 0;
const problems = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  let from = 0;
  for (;;) {
    const at = src.indexOf("<Lab", from);
    if (at < 0) break;
    from = at + 4;
    const end = src.indexOf("</Lab>", at);
    const block = src.slice(at, end < 0 ? undefined : end);
    if (!/verify="self-check"/.test(block)) continue;
    const expect = block.match(/expect="([^"]+)"/)?.[1];
    const si = block.indexOf("starter={`");
    if (!expect || si < 0) continue;
    const lit = block.slice(si + "starter={".length, block.indexOf("`}", si) + 1);
    let code;
    try {
      code = eval(lit); // the same template literal the page renders
    } catch (e) {
      problems.push(`${file}: starter template does not evaluate: ${e.message}`);
      continue;
    }
    if (!/^package main\b/m.test(code)) continue; // not a Go program (e.g. a Dockerfile lab)
    checked++;
    fs.writeFileSync(path.join(tmp, "main.go"), code);
    const bin = path.join(tmp, "lab.bin");
    try {
      execSync(`go build -o ${bin} .`, { cwd: tmp, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
    } catch {
      continue; // doesn't build: the reader has to write the missing API first
    }
    let passes = 0;
    for (let r = 0; r < RUNS; r++) {
      let out = "";
      try {
        out = execSync(bin, { cwd: tmp, stdio: ["ignore", "pipe", "pipe"], timeout: 60000 }).toString();
      } catch (e) {
        out = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "");
      }
      if (out.includes(expect)) passes++;
    }
    if (passes > 0) {
      problems.push(`${file}: the STARTER printed "${expect}" in ${passes}/${RUNS} runs, so the lab can pass with no work`);
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`[verify-labs] checked ${checked} self-check lab starters`);
if (problems.length) {
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("[verify-labs] ✓ no starter passes its own check");
