# Technical Accuracy Audit — test-driven-development (part-1/10-test-driven-development.mdx)

REPORT ONLY. No content file was edited. Verdicts below are proposals for a human/editor to apply.

Tier-2 audit. Focus: TDD red-green-refactor + characterization-test claims; the testing
APIs/version attributions used; Go-mechanics claims (implicit interfaces, escape analysis,
test cache, integer truncation, int64-vs-float at compile time). Verified against
pkg.go.dev, go.dev/doc/go1.26, and cmd/go testing-flags docs.

## Accuracy audit — test-driven-development

| Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|
| L869 (UnderTheHood): "**As of Go 1.26**, the test cache (`GOCACHE`) stores passing test results and skips re-running tests whose inputs … haven't changed. `go test` with a cold cache compiles and runs; with a warm cache it exits instantly with a `(cached)` tag." | **WRONG (version attribution) / OUTDATED framing** | go.dev/doc/go1.26 testing/cmd-go release notes contain **no** mention of any test-cache change. The test result cache is a long-standing feature (introduced ~Go 1.10), described version-agnostically in cmd/go: *"In package list mode only, go test caches successful package test results … go test prints '(cached)' in place of the elapsed time."* Pinning it to "As of Go 1.26" implies it is new/changed in 1.26, which is false. | Drop the "As of Go 1.26" pin. The behavior itself is correctly described — only the version attribution is wrong. Reword to: "The Go tool caches successful package test results (the `(cached)` tag); a warm cache exits instantly when inputs are unchanged." (No version, or "since Go 1.10" if a version is wanted.) |
| L869: "This cache is precise: touching any source file in the package invalidates **only that package's cache entry**." | **IMPRECISE** | cmd/go: cache matching is keyed on the test binary + cacheable flags; editing a source file changes the compiled package and thus its (and dependents') cache key. Saying it invalidates "only that package's cache entry" understates that **importing packages** are also recompiled/re-run because their inputs transitively changed. | Soften: "…invalidates that package's entry (and any package that imports it), not the whole suite." Low severity. |
| L248 (UnderTheHood): "Escape analysis looks at each call site and may keep concrete values on the stack when it can prove they do not outlive the function." | **CORRECT (already hedged)** | General Go escape-analysis behavior; statement is correctly hedged ("may", "when it can prove"). No primary-source contradiction. | Leave as-is. (Listed here only because it is a falsifiable internals claim that was checked.) |

### Claims verified CORRECT (sampled — checked against a fetched source or against TDD canon)

1. L36 / L154 / L873 — "A compile error **IS** the red bar / a valid red state." **CORRECT.** A non-compiling `*_test.go` is reported by `go test` as a build failure for that package = the test does not pass = valid red. Consistent with cmd/go behavior (FAIL on build error) and with red-green-refactor canon (the test must be observed to fail before code is written).
2. L240–246 (UnderTheHood) — "Go's interface system is **implicit**: a type satisfies an interface by having the right methods — no declaration required," and consumer-defined interfaces enable interface segregation. **CORRECT.** Matches the Go language spec's structural interface satisfaction and the "accept interfaces" proverb; not a falsifiable defect.
3. L867 — "the Go tool compiles a separate test binary for each package … links in the `testing` package. There is no external test runner, no config file." **CORRECT** per cmd/go (one test binary per package under test).
4. Exercise 1, L935/939 — "`return amountCents / 100` … Integer division gives you truncation for free — no `math.Round` needed." **CORRECT.** Go spec: integer division truncates toward zero; `1099 / 100 == 10` as the test row asserts (L911). The fee table (10000→100, 1099→10) is arithmetically correct.
5. L505 / L530 / L586–588 — `Amount int64` "prevents fractional cents **at the type level** / at compile time"; the compiler refuses a `float64`. **CORRECT.** Go requires an explicit conversion between float64 and int64; assigning/passing a float literal where int64 is expected without conversion is a compile error. The "no runtime check needed" claim is sound.
6. L526 — Cycle-5 test "PASS immediately … green before we add code … which is correct" (1-cent transfer valid; int64 already prevents fractions). **CORRECT** reasoning: a test that documents an already-satisfied type-level invariant legitimately starts green; the chapter flags this as the intentional exception, consistent with TDD discipline.
7. Money modeled as `int64` cents throughout (struct fields, validator, exercises, lab). **CORRECT** per the audit's money-as-integer-minor-units rule — no `float64` for money anywhere in the chapter. (Landmine check: clean.)
8. L171–179 QuickCheck — a test that passes before any production code is written means either the behavior already exists or the test cannot fail; investigate. **CORRECT** TDD reasoning (the "red must be genuinely red" rule).
9. L1124–1145 (rate-limiter exercise) — consumer-defined `RateLimitStore` interface with the single method the caller needs; fake configures count/error per row. **CORRECT** application of consumer-interface + hand-rolled-fake pattern; no Go-semantics error.

### Notes on scope coverage requested by the prompt

- **Characterization-test claims:** the chapter does **not** use the term "characterization test" nor make claims about characterizing legacy/untested code. The "spike first, then TDD the survivors" advice (L827) is the closest analog and is sound (exploratory throwaway code before locking behavior). Nothing to flag.
- **red-green-refactor:** all three steps (red proves the test can fail; green = minimum code; refactor under a green bar) are described in line with TDD canon (Beck). No mechanical/version defects beyond the test-cache attribution above.
- **Go-version attributions:** the only version-pinned mechanical claim in the chapter is the L869 test-cache "As of Go 1.26" — flagged WRONG above. The chapter otherwise avoids version-specific testing-API claims (those live in chapter 09).

### Tally — TDD chapter

- **WRONG: 1** (test-cache "As of Go 1.26" version attribution, L869)
- **IMPRECISE: 1** (cache invalidation "only that package", L869)
- **OUTDATED: 0** (folded into the WRONG row — it is a misattribution rather than stale-but-once-true)
- **UNVERIFIABLE: 0**
- **CORRECT (sampled, verified): 9+**
- Total flagged rows: **2** WRONG/IMPRECISE (+1 internals row checked and left CORRECT)

**Worst finding:** L869 attributes the `go test` result cache to "**As of Go 1.26**." Go 1.26's release notes describe no test-cache change, and the cache is a long-standing feature (≈ Go 1.10). The described behavior (the `(cached)` tag, input-keyed invalidation) is accurate, but the version pin is false and would hand a reader a wrong belief that test caching is a recent 1.26 capability. Fix = remove the "As of Go 1.26" pin (the rest of the paragraph stands).

### Sources fetched (URLs actually opened)

- https://go.dev/doc/go1.26 (confirmed NO test-cache change in 1.26; T.ArtifactDir; B.Loop inlining)
- https://pkg.go.dev/cmd/go#hdr-Testing_flags (test result cache description, `(cached)` tag, cacheable flags, no version pin)
- https://pkg.go.dev/testing (one-test-binary-per-package model, T/B APIs referenced)
- https://go.dev/doc/go1.24 and https://go.dev/doc/go1.25 (cross-checked for any TDD-relevant testing-API version claims — none present in this chapter)

Frontmatter unchanged: yes (no file edited — report only).
Flags left for human review: 0 inline {/* ACCURACY */} comments added (REPORT-ONLY mode; all findings are in this log).
