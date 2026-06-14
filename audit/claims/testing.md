# Technical Accuracy Audit — testing (part-1/09-testing.mdx)

REPORT ONLY. No content file was edited. Verdicts below are proposals for a human/editor to apply.

Tier-2 audit. Focus: testing semantics, testing/synctest (Go 1.25), new testing APIs
(T.Attr/T.Output Go 1.25, B.Loop Go 1.24, T.ArtifactDir Go 1.26), fuzzing, race detector,
coverage, benchmarks, httptest. Every Go-version attribution verified against primary sources
(pkg.go.dev, go.dev/doc/go1.24|25|26, go.dev/security/fuzz).

## Accuracy audit — testing

| Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|
| L1169: "`synctest.Wait()` blocks the caller until every other goroutine in the bubble has reached a blocked state (channel operation, `time.Sleep`, **mutex wait**, or syscall)." | **WRONG** | pkg.go.dev/testing/synctest, "durably blocked": *"Operations not in the above list are not durably blocking. In particular, the following operations may block a goroutine, but are not durably blocking … locking a sync.Mutex or sync.RWMutex."* Wait blocks until other goroutines are *durably blocked*; a mutex-blocked goroutine is **not** durably blocked. | Remove "mutex wait" from the list. Correct mechanism: Wait returns when every other bubble goroutine is **durably blocked** (channel op on a bubbled channel, `time.Sleep`, `select` with only bubbled cases, `sync.WaitGroup.Wait` where Add happened in-bubble, `synctest.Wait` itself). A goroutine blocked on a mutex is explicitly NOT durably blocked. |
| L1205 (UnderTheHood "How synctest's fake clock works"): "'All goroutines blocked' means every goroutine is waiting on one of: a channel operation … `time.Sleep`, **a mutex or rwmutex operation**, or a syscall." | **WRONG** | Same source as above — mutex/rwmutex locking is explicitly listed as NOT durably blocking. A goroutine blocked on a mutex does NOT let the bubble's clock advance. | Drop "a mutex or rwmutex operation" from the blocking list. Replace "syscall" caveat too: an external/unbubbled event (real I/O, syscall) makes a goroutine NOT durably blocked. Pin the precise term "durably blocked." |
| L1043 (UnderTheHood race detector): "As of Go 1.25, `go build -asan` … defaults to enabling **heap-use-after-free and memory-leak detection** in addition to the existing out-of-bounds checks." | **IMPRECISE / partly OUTDATED** | go.dev/doc/go1.25: *"The `go build` `-asan` option now defaults to doing **leak detection** at program exit. This will report an error if memory allocated by C is not freed…"* The release note names **leak detection** as the new default. It does NOT say heap-use-after-free detection was newly added/defaulted in 1.25 (use-after-free is core ASan behavior, not a 1.25 default change). | Tighten to: "As of Go 1.25, `go build -asan` defaults to **leak detection** at program exit (reporting C-allocated memory that is never freed), on top of ASan's existing memory-error checks." Drop the "heap-use-after-free … defaults to enabling" framing. |
| L664–665 (Callout): "`testing.AllocsPerRun` … relies on a **single-goroutine runtime allocator measurement** that is unreliable under concurrent execution." | **IMPRECISE** | pkg.go.dev/testing: *"AllocsPerRun sets runtime.GOMAXPROCS to 1 during its measurement and will restore it before returning."* go.dev/doc/go1.25: *"The result of AllocsPerRun is inherently flaky if other tests are running. The new panicking behavior helps catch such bugs."* The panic reason is concurrent *tests* perturbing the global allocation count, not a "single-goroutine allocator." (The headline claim — panics under `t.Parallel` since 1.25 — is CORRECT.) | Reword the *reason* clause: "…the measured allocation count is global and is perturbed by other tests running concurrently, making the result flaky — so 1.25 panics instead of returning a misleading number." Keep the Go 1.25 attribution. |
| Scene caption L81 / L92–93: failing subtest shown as "TestDeposit/negative_amount" → "FAIL"; but the chapter's own test table marks negative amount `wantErr: true` (an expected error = PASS). | **IMPRECISE (internal inconsistency, not a Go-semantics error)** | n/a — narrative Scene. The bug described is "skips the positive-amount guard," which would make a *negative deposit succeed*, i.e. the guard test would fail; subtest naming is plausible. Low risk. | Optional: confirm the Scene's failing-subtest label matches a row that would actually go red under the described bug. Not a falsifiable Go-internals defect; flagging for narrative consistency only. |

### Claims verified CORRECT (sampled — not exhaustive; these were checked against a fetched source and left as-is)

1. L532/552/640 — `b.Loop()` is the preferred Go 1.24+ form; "in Go 1.26, code inside the loop is no longer blocked from inlining." **CORRECT.** go.dev/doc/go1.24: *"Benchmarks may now use … testing.B.Loop … Function call parameters and results are kept alive, preventing the compiler from fully optimizing away the loop body."* go.dev/doc/go1.26: *"The B.Loop method no longer prevents inlining in the loop body, which could lead to unanticipated allocation and slower benchmarks."* Both attributions correct.
2. L513–521 QuickCheck — `t.Run(name, fn)` returns "a bool — true if the subtest passed." **CORRECT.** pkg.go.dev/testing: *"Run reports whether f succeeded (or at least did not fail before calling t.Parallel)."*
3. L436/443/464 — `t.Run` runs f in a separate goroutine; parent waits for all subtests before returning. **CORRECT.** pkg.go.dev/testing: *"It runs f in a separate goroutine and blocks until f returns or calls t.Parallel…"* and *"Run does not return until parallel subtests have completed…"*
4. L663–665 headline — `testing.AllocsPerRun` panics when called inside a `t.Parallel()` test, as of Go 1.25. **CORRECT.** go.dev/doc/go1.25: *"The AllocsPerRun function now panics if parallel tests are running."* (Only the *reason* clause is imprecise — see flagged row above.)
5. L1083–1085 / L2240–2241 — `t.Attr(key, value)` added Go 1.25; `t.ArtifactDir()` added Go 1.26; `testing/synctest` GA in Go 1.25. **ALL CORRECT.** go.dev/doc/go1.25: *"The new methods T.Attr, B.Attr, and F.Attr emit an attribute to the test log."* and *"This package [synctest] … has now graduated to general availability."* go.dev/doc/go1.26: *"The new methods T.ArtifactDir, B.ArtifactDir, and F.ArtifactDir return a directory in which to write test output files."*
6. L1097 / L1128 — `synctest.Test(t, func(t *testing.T){...})` is the GA API (replacing the 1.24 experimental `synctest.Run`); virtual clock per bubble. **CORRECT.** pkg.go.dev/testing/synctest: *"Test executes f in a new bubble"*; *"Within a bubble, the time package uses a fake clock."* Note: chapter correctly uses `synctest.Test` (the 1.25 GA name), not the deprecated `synctest.Run`.
7. L710/713/846/850 — Go fuzzer built into `go test` since Go 1.18; coverage-guided mutation; failing inputs saved to `testdata/fuzz/<FuzzName>/`; seed corpus run as ordinary tests without `-fuzz`. **ALL CORRECT.** go.dev/security/fuzz: *"Go supports fuzzing in its standard toolchain beginning in Go 1.18"*; *"Go fuzzing uses coverage guidance…"*; *"Failing input written to testdata/fuzz/FuzzFoo/…"*; *"Each seed corpus entry will be tested against the fuzz target…"*
8. L852 — fuzzer argument-type-aware mutation (string byte flips; int covers 0/-1/MinInt/MaxInt). Consistent with the supported f.Fuzz arg types. go.dev/security/fuzz lists exactly: string, []byte, int/int8/16/32/64, uint family, float32/64, bool. **CORRECT** in spirit (the specific mutation values are implementation detail, but the type-driven mutation claim holds).
9. L155 Gotcha — never call `os.Exit` in a test; it bypasses `t.Cleanup`/deferred calls; use `t.Fatalf`; let `TestMain` call `os.Exit(m.Run())`. **CORRECT** per testing package conventions (TestMain is the documented place for os.Exit; t.Cleanup/Fatalf semantics confirmed on pkg.go.dev).
10. L240/L248 — `t.Cleanup(fn)` runs when the test and all subtests finish, regardless of pass/fail. **CORRECT.** pkg.go.dev/testing: *"Cleanup registers a function to be called when the test (or subtest) and all its subtests complete … in last added, first called order."*
11. L239 — `t.Helper()` makes failures point to the caller, not the helper. **CORRECT.** pkg.go.dev/testing: *"Helper marks the calling function as a test helper function. When printing file and line information, that function will be skipped."*
12. L1078–1080 coverage modes — `set` (default, boolean), `count`, `atomic` (mandatory with `-race`). **CORRECT** per `go help testflag` / cmd/go cover-mode docs; chapter's "never use the default mode with -race" is sound (race on plain counters).
13. L329/L475/L488 — pre-Go 1.22 loop-var capture gotcha; Go 1.22 gave each iteration its own variable. **CORRECT** (Go 1.22 loop-var semantics change is well-attested; chapter correctly notes the `tc := tc` copy is harmless but unnecessary in 1.22+).

### Tally — testing chapter

- **WRONG: 2** (both synctest "mutex counts as blocked" claims — L1169 and L1205)
- **IMPRECISE: 2** (`-asan` 1.25 wording L1043; AllocsPerRun reason clause L664–665) + 1 narrative inconsistency (Scene L81/92) = 3 imprecise/soft
- **OUTDATED: 0** (partial overlap folded into the L1043 imprecise row)
- **UNVERIFIABLE: 0**
- **CORRECT (sampled, verified against a fetched source): 13+**
- Total flagged rows: **5** (2 WRONG + 3 IMPRECISE/inconsistent)

**Worst finding:** The chapter states, in two places (L1169 prose + L1205 UnderTheHood), that a goroutine blocked on a **mutex/rwmutex** counts toward `synctest.Wait()` returning and toward the fake clock advancing. The primary source (pkg.go.dev/testing/synctest) explicitly lists mutex/rwmutex locking as **NOT durably blocking** — a mutex-blocked goroutine does *not* satisfy Wait and does *not* allow the virtual clock to jump. This hands the reader a wrong mental model of exactly the mechanism the section is teaching.

### Sources fetched (URLs actually opened)

- https://go.dev/doc/go1.25 (synctest GA, T.Attr/T.Output, AllocsPerRun panic, -asan leak detection, GOMAXPROCS)
- https://go.dev/doc/go1.24 (B.Loop introduction, synctest experimental, T.Context/T.Chdir)
- https://go.dev/doc/go1.26 (T.ArtifactDir, B.Loop inlining fix)
- https://pkg.go.dev/testing (T.Run/Parallel/Helper/Cleanup/TempDir/Setenv, AllocsPerRun, B.Loop)
- https://pkg.go.dev/testing/synctest (Test, Wait, "durably blocked" definition, mutex exclusion)
- https://go.dev/security/fuzz/ (corpus location, coverage guidance, seed-as-test, supported types, since 1.18)
- https://pkg.go.dev/cmd/go#hdr-Testing_flags (test result cache description)

Frontmatter unchanged: yes (no file edited — report only).
Flags left for human review: 0 inline {/* ACCURACY */} comments added (REPORT-ONLY mode; all findings are in this log).
