# Accuracy audit — project-blog-aggregator

Chapter: `content/part-1/23-project-blog-aggregator.mdx` (Tier-3 project chapter — light sweep, internals/version claims only).
REPORT ONLY — no content file was edited. Fixes are proposed, not applied.

This chapter is mostly application architecture (sqlc, auth middleware, cursor pagination, a ticker+semaphore scraper, Redis cache-aside, a test suite). Falsifiable claims are concentrated in the version-attribution callouts and `<UnderTheHood>` boxes. Most are correct; one version/infra fact is confidently wrong.

| Claim (as written) | Verdict | Source | Proposed action |
|---|---|---|---|
| (L819, L931) "`wg.Go` (new in Go 1.25) … increments the counter and launches the goroutine as one operation." | CORRECT | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | None. |
| (L818, L933) "Go 1.22+: range variables are per-iteration — no capture bug." | CORRECT | Well-established Go 1.22 loopvar change (consistent with the audit landmine list). | None. |
| (L382, QuickCheck) "signal.NotifyContext (Go 1.16+) returns a context.Context that is cancelled when the process receives the specified signal." | CORRECT | `signal.NotifyContext` was added in Go 1.16. | None. |
| (L1085–1087) "Go 1.25 added `testing/synctest` … controlling a fake clock and goroutine scheduling." | CORRECT | go.dev/doc/go1.25: "The new `testing/synctest` package provides support for testing concurrent code … time is virtualized … fake clock"; graduated from the 1.24 `GOEXPERIMENT=synctest`. | None. |
| (L1420, L1426) "The Go race detector (available since Go 1.1) instruments … using ThreadSanitizer (TSan) … programs compiled with `-race` run roughly 2–20x slower and use 5–10x more memory." | CORRECT (since-1.1) / IMPRECISE (overhead numbers) | Race detector shipped in Go 1.1 (correct). Official guidance states ~10x CPU and ~5–10x memory; "2–20x slower" is a wide-but-defensible band, already hedged with "roughly." | Leave; optionally tighten "2–20x" toward the commonly cited ~10x. Not a defect. |
| (L869) "io.ReadAll is noticeably faster in Go 1.26 due to a more efficient internal buffer growth strategy — prefer it over **ioutil.ReadAll (removed in 1.16)**." | WRONG (two issues) | pkg.go.dev/io/ioutil: "**Deprecated:** As of Go 1.16 … those implementations should be preferred"; package is still present in the stdlib as of Go 1.26 — **deprecated, not removed**. The "io.ReadAll faster in Go 1.26" sub-claim is UNVERIFIABLE (no fetchable go1.26 source). | Fix "removed in 1.16" → "deprecated in Go 1.16 (still present, but use `io.ReadAll`)". Downgrade/drop the "faster in Go 1.26" perf claim. |

## Notes
- The same "io.ReadAll faster in Go 1.26" line appears in multiple chapters; flag consistently as UNVERIFIABLE wherever it occurs.
- Architecture-level claims (cache-aside vs authoritative data, ON CONFLICT DO NOTHING idempotency, cursor vs offset pagination, semaphore-as-counting-channel) are conceptually correct and out of scope for an internals sweep.
- CORRECT (verified) count: 4 (`wg.Go` 1.25; `testing/synctest` 1.25; loopvar 1.22; race detector since 1.1).

Sources fetched:
- https://go.dev/doc/go1.25
- https://pkg.go.dev/io/ioutil

Flags proposed for human review: 1 — line 869 ("ioutil.ReadAll removed in 1.16" WRONG → deprecated-not-removed; plus UNVERIFIABLE Go 1.26 perf sub-claim).
Content file edited: no.
