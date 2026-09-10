/**
 * Inventories Go version claims across the chapter corpus and checks them
 * against a table of facts verified from the release notes.
 *
 * The accuracy guide forbids certifying a falsifiable claim from memory, so
 * VERIFIED_FACTS below records what was confirmed against go.dev/doc/go1.N and
 * when. A claim attributing one of these features to a different release is
 * reported; so is any claim about a release newer than the corpus target,
 * because those are the ones that quietly go stale.
 *
 *   node scripts/audit-version-claims.mjs
 */
import fs from "fs";
import path from "path";

const CONTENT_DIR = "content";
const TARGET = "1.27"; // keep in step with GO_VERSION in test-snippets.mjs

/** feature → release that introduced it. Confirmed against the release notes
 *  on 2026-09-10; re-check rather than trusting this table blindly. */
const VERIFIED_FACTS = [
  { re: /\bsignal\.NotifyContext\b/, feature: "signal.NotifyContext", version: "1.16" },
  { re: /\bGOMEMLIMIT\b/, feature: "GOMEMLIMIT", version: "1.19" },
  { re: /\bsync\.OnceValue\b/, feature: "sync.OnceValue", version: "1.21" },
  { re: /\bcmp\.Ordered\b/, feature: "cmp.Ordered", version: "1.21" },
  { re: /loop var\w*[^.]{0,60}?per.iteration/i, feature: "per-iteration loop vars", version: "1.22" },
  { re: /\biter\.Seq\b/, feature: "iter.Seq", version: "1.23" },
  { re: /\bb\.Loop\(\)/, feature: "testing.B.Loop", version: "1.24" },
  { re: /\btesting\/synctest\b/, feature: "testing/synctest", version: "1.25" },
  { re: /\bWaitGroup\.Go\b/, feature: "sync.WaitGroup.Go", version: "1.25" },
  { re: /\bwaitgroup\b.{0,40}\bhostport\b/i, feature: "waitgroup/hostport vet passes", version: "1.25" },
  { re: /\bCrossOriginProtection\b/, feature: "net/http.CrossOriginProtection", version: "1.25" },
  { re: /Green Tea/i, feature: "Green Tea GC as default", version: "1.26" },
  { re: /\bArtifactDir\b/, feature: "testing T.ArtifactDir", version: "1.26" },
  { re: /\berrors\.AsType\b/, feature: "errors.AsType", version: "1.26" },
  { re: /generic method/i, feature: "generic methods", version: "1.27" },
];

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

const ATTRIBUTION =
  /(?:new in|added in|introduced in|since|as of|landed in|shipped in|arrived in|available (?:in|since))\s*(?:Go\s*)?1\.(\d{1,2})|Go\s*1\.(\d{1,2})\s+(?:added|introduced|brought|made|changed|switched|fixed|removed|deprecated)/gi;

const conflicts = [];
const ahead = [];
let claimCount = 0;

for (const file of walk(CONTENT_DIR)) {
  const rel = file.replace(CONTENT_DIR + "/", "");
  fs.readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const versions = [...line.matchAll(ATTRIBUTION)].map((m) => "1." + (m[1] ?? m[2]));
      if (!versions.length) return;
      claimCount += versions.length;

      for (const fact of VERIFIED_FACTS) {
        const hit = line.match(fact.re);
        if (!hit) continue;
        if (versions.includes(fact.version)) continue;

        // A single line often names several releases for several features, so
        // a version elsewhere in the sentence is not a claim about THIS one.
        // Only report when an attribution sits close to the feature mention.
        const featureAt = hit.index ?? 0;
        const near = [...line.matchAll(ATTRIBUTION)].some((m) => {
          const v = "1." + (m[1] ?? m[2]);
          return v !== fact.version && Math.abs((m.index ?? 0) - featureAt) < 60;
        });
        if (!near) continue;

        conflicts.push({ rel, line: i + 1, feature: fact.feature, expected: fact.version, saw: versions.join(", ") });
      }

      for (const v of versions) {
        if (Number(v.slice(2)) > Number(TARGET.slice(2))) {
          ahead.push({ rel, line: i + 1, version: v });
        }
      }
    });
}

console.log(`Corpus target: Go ${TARGET}`);
console.log(`Attribution claims scanned: ${claimCount}`);

console.log(`\nContradicting a verified fact: ${conflicts.length}`);
for (const c of conflicts.slice(0, 25)) {
  console.log(`  ${c.rel}:${c.line}  ${c.feature} is ${c.expected}, line says ${c.saw}`);
}

console.log(`\nClaims about a release newer than the target: ${ahead.length}`);
for (const a of ahead.slice(0, 25)) console.log(`  ${a.rel}:${a.line}  Go ${a.version}`);

console.log(
  `\nReported items are for review, not automatic defects — a sentence may legitimately`
);
console.log(`name several releases. This never exits non-zero; it is an inventory, not a gate.`);
