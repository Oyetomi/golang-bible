# Accuracy audit — project-pokedex

Chapter: `content/part-1/17-project-pokedex.mdx` (Tier-3 project chapter — light sweep, internals/version claims only).
REPORT ONLY — no content file was edited. Fixes are proposed, not applied.

This chapter is mostly application code (REPL, typed API client, TTL cache, httptest suite). The only falsifiable internals/version claims are in the `<UnderTheHood>` boxes. All were checked against fetched primary sources; the mutex internals and ticker-GC claims are correct.

| Claim (as written) | Verdict | Source | Proposed action |
|---|---|---|---|
| (L941) "`sync.Mutex` is a two-word struct: a `state` int32 and a `sema` uint32." | CORRECT | `internal/sync/mutex.go` @ go1.25.0: `type Mutex struct { state int32; sema uint32 }` (relocated from `sync` to `internal/sync` in Go 1.25, but fields/layout unchanged) | None. (Optional nicety: note the struct now lives in `internal/sync` since 1.25 — not required for correctness.) |
| (L945) "**Starvation mode** (added in Go 1.9 … ): if a goroutine has been waiting for more than 1 ms, the mutex enters starvation mode … The 1 ms threshold is an implementation detail" | CORRECT (1 ms verified); version pin UNVERIFIED | `internal/sync/mutex.go` @ go1.25.0: `starvationThresholdNs = 1e6` (= 1 ms); starvation-mode comment confirms front-of-queue handoff after ~1 ms. "added in Go 1.9" not pinned to a fetched 1.9 source. | Leave as-is. The 1 ms value and mechanism are source-confirmed; the "Go 1.9" attribution is historically accurate and the chapter already hedges the threshold as "an implementation detail." Low risk — no change needed. |
| (L949) "Since Go 1.23, unreachable tickers can be garbage-collected" | CORRECT | go.dev/doc/go1.23: "`Timer`s and `Ticker`s that are no longer referred to by the program become eligible for garbage collection immediately, even if their `Stop` methods have not been called." | None. |
| (L628) "As of Go 1.26, `io.ReadAll` is faster than earlier releases … " | UNVERIFIABLE | No fetchable primary source (go1.26 release notes not reachable / Go 1.26 forward-looking). | Downgrade the confident "As of Go 1.26, `io.ReadAll` is faster" to a hedge or drop the perf claim; keep the (correct) advice to prefer the streaming decoder. Soft flag only — not load-bearing. |
| (L624) "decode JSON `null` into a `*string`, Go sets the pointer to `nil` … This has worked this way since Go 1.0" | CORRECT (and explicitly hedged) | Standard `encoding/json` semantics; null → nil pointer. | None. |

## Notes
- Application-code correctness (cache mutex usage, httptest patterns, atomic counter rationale, `context.Background()` in a REPL) is sound and out of scope for a Tier-3 internals sweep — no Go-mechanics errors found.
- CORRECT (verified) count: 3 (mutex two-word layout; 1 ms starvation threshold; ticker GC since 1.23).

Sources fetched:
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/internal/sync/mutex.go
- https://go.dev/doc/go1.23

Flags proposed for human review: 1 — the "As of Go 1.26 io.ReadAll is faster" line (UNVERIFIABLE; downgrade).
Content file edited: no.
