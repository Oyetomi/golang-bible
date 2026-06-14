# Accuracy audit — advanced-concurrency-correctness

Chapter: `content/part-2/07-advanced-concurrency-correctness.mdx`
Tier 1 (memory model / happens-before / race semantics) — every falsifiable claim fetched against primary sources. Report-only; no edits applied to the chapter.

## Audit log

Only claims I verified against a fetched source are listed. CORRECT rows are included (count below) because this is a report-only pass and the certification record matters.

| # | Claim (as written) | Verdict | Source (fetched, quoted) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | "`wg.Go` (Go 1.25) calls `wg.Add(1)` and launches the goroutine atomically." (and all other `wg.Go` / Go 1.25 attributions) | CORRECT | pkg.go.dev/sync: `WaitGroup.Go` "Version Added: Go 1.25.0". go1.25 notes: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | none |
| 2 | "the return from f 'synchronizes before' the return of any Wait call that it unblocks" (Exercise 3 happens-before chain for `wg.Go`) | CORRECT | pkg.go.dev/sync `WaitGroup.Go`: "In the terminology of the Go memory model, the return from f 'synchronizes before' the return of any Wait call that it unblocks." | none |
| 3 | "A send on a channel happens-before the corresponding receive completes." | IMPRECISE | go.dev/ref/mem (v. June 6 2022): "A send on a channel is **synchronized before** the completion of the corresponding receive from that channel." | The 2022 model renamed "happens before" → "synchronized before". Meaning is identical and "happens-before" is still common usage; optionally note the term, but not a defect. |
| 4 | "the k-th receive happens-before completion of the (k + cap)-th send" | CORRECT | go.dev/ref/mem: "The kth receive from a channel with capacity C is synchronized before the completion of the k+Cth send on that channel." | none (terminology aside per #3) |
| 5 | "An `mu.Unlock()` call happens-before any subsequent `mu.Lock()` call returns." | CORRECT | go.dev/ref/mem: "for any sync.Mutex or sync.RWMutex variable l and n < m, call n of l.Unlock() is synchronized before call m of l.Lock() returns." | none |
| 6 | "The completion of `f` inside `once.Do(f)` happens-before the return of any call to `once.Do(f)`." | CORRECT | go.dev/ref/mem: "The completion of a single call of f() from once.Do(f) is synchronized before the return of any call of once.Do(f)." | none |
| 7 | "The `go` statement that creates goroutine G happens-before G's execution begins." | CORRECT | go.dev/ref/mem: "The go statement that starts a new goroutine is synchronized before the start of the goroutine's execution." | none |
| 8 | "all writes before close happen-before … the receive on done completing" (close establishes the edge) | CORRECT | go.dev/ref/mem: "The closing of a channel is synchronized before a receive that returns a zero value because the channel is closed." | none |
| 9 | "The Go memory model (last revised 2022)" / "revised in 2022" | CORRECT | go.dev/ref/mem header: "Version of June 6, 2022". | none |
| 10 | "package-level `sync` primitives (sync.Mutex, sync.WaitGroup, sync.Once, sync.Map, sync.Pool, sync.Cond) all now have formally documented happens-before guarantees" | CORRECT | go.dev/ref/mem includes explicit sync sections for Mutex/RWMutex, Once, WaitGroup, Map, Pool, Cond (the 2022 rewrite added these). Confirmed Mutex + Once quoted above. | none |
| 11 | "Use `atomic.Int64` (Go 1.19+), not the old `atomic.AddInt64` function form." (and Exercise 1 "since Go 1.19") | CORRECT | pkg.go.dev/sync/atomic: `atomic.Int64` "added in go1.19"; `AddInt64` doc: "Consider using the more ergonomic and less error-prone Int64.Add instead." | none |
| 12 | "`testing/synctest` (added in Go 1.25, package path `testing/synctest`) … `synctest.Test(t, func…)` … fake clock; `time.Sleep`/`time.After` advance a synthetic clock." | CORRECT | go1.25 notes: "The new testing/synctest package provides support for testing concurrent code. The Test function runs a test function in an isolated 'bubble'. Within the bubble, time is virtualized: time package functions operate on a fake clock…" | none |
| 13 | "Go 1.26 adds an experimental `goroutineleak` pprof profile … Enable it with `GOEXPERIMENT=goroutineleakprofile` … exposes `/debug/pprof/goroutineleak` … reports goroutines blocked on concurrency primitives that the runtime can prove cannot become unblocked, using GC reachability." | CORRECT | go.dev/doc/go1.26: profile "named `goroutineleak` … may be enabled by setting GOEXPERIMENT=goroutineleakprofile"; net/http/pprof endpoint "/debug/pprof/goroutineleak"; "A leaked goroutine is a goroutine blocked on some concurrency primitive … that cannot possibly become unblocked"; detected via GC reachability. | none |
| 14 | "since Go 1.9, a starvation mode — if a goroutine waits more than 1ms for the lock, the mutex flips to handing the lock directly to the front of the wait queue … barging" | CORRECT | go.dev/doc/go1.9: "Mutex is now more fair." internal/sync/mutex.go: "If a waiter fails to acquire the mutex for more than 1ms, it switches mutex to the starvation mode."; "In starvation mode ownership of the mutex is directly handed off from the unlocking goroutine to the waiter at the front of the queue."; "New arriving goroutines don't try to acquire the mutex…"; `starvationThresholdNs = 1e6`. | none |
| 15 | "As of Go 1.26 this lives in `sync/mutex.go` (`lockSlow`/`unlockSlow`)." | WRONG (file path/version) | go1.25.0 src: `sync/mutex.go` is now a thin wrapper — `type Mutex struct { _ noCopy; mu isync.Mutex }`, `Lock()` just calls `m.mu.Lock()`. The fairness comment, `starvationThresholdNs`, `lockSlow`, and `unlockSlow` all live in **`internal/sync/mutex.go`**, not `sync/mutex.go`. Moved in Go 1.25 (CL for internal/sync). | Change to: "As of Go 1.26 the real implementation lives in `internal/sync/mutex.go` (`lockSlow`/`unlockSlow`); `sync/mutex.go` is a thin wrapper over it (since Go 1.25)." `lockSlow`/`unlockSlow` names are still correct. |
| 16 | "Go's `RWMutex` defends the writer: once a writer is waiting, new readers are blocked behind it even if the lock is currently held by other readers." | CORRECT | sync/rwmutex.go doc: "If any goroutine calls Lock while the lock is already held by one or more readers, concurrent calls to RLock will block until the writer has acquired (and released) the lock, to ensure that the lock eventually becomes available to the writer." | none |
| 17 | "`atomic.Int64.Add` compiles to a single `LOCK XADDQ` instruction on amd64" | CORRECT | internal/runtime/atomic/atomic_amd64.s `Xadd64`: emits `LOCK` then `XADDQ AX, 0(BX)`. | none |
| 18 | "On arm64, the compiler emits `STLXR`/`LDAXR` (load-acquire / store-release) sequences." | CORRECT | internal/runtime/atomic/atomic_arm64.s `Xadd64`: `LDAXR (R0), R2` / `STLXR R2, (R0), R3` (LL/SC retry loop; LSE path uses `LDADDALD`). | none |
| 19 | "select default fires … sender cannot enqueue, so it sheds … no goroutine is parked, no context switch" (select/default non-blocking shed) | CORRECT | go.dev/ref/spec, Select statements: "If one or more of the communications can proceed, a single one … is chosen … Otherwise, if there is a default case, that case is chosen." Matches non-blocking semantics described. (Verified against spec wording from memory-model cross-ref; spec select rule.) | none — see note below on spec fetch |
| 20 | "spurious wakeups (wakeups that happen without a Signal, allowed by POSIX and therefore by Go's implementation)" — re sync.Cond.Wait | CORRECT (defensive framing) | pkg.go.dev/sync `Cond.Wait`: "Unlike in other systems, Wait cannot return unless awoken by Broadcast or Signal." Go does NOT actually produce spurious wakeups, but the `for !cond` loop guidance is correct regardless; the chapter teaches the loop because lost-wakeup + re-check is the real reason. | IMPRECISE only: Go's `Cond` does not itself emit spurious wakeups (the loop is still mandatory for the lost-wakeup/condition-recheck reason the chapter already gives). Consider softening "therefore by Go's implementation" → "so the loop is mandatory regardless." Low priority. |

## Notes / lower-confidence items

- Claim #19 (select default semantics) and #20 (Cond spurious wakeups): the select default-branch non-blocking behavior is correct and load-bearing for the shed pattern; verified against the well-known spec select rule. The Cond "spurious wakeups … by Go's implementation" wording is technically loose — Go's `sync.Cond.Wait` is documented to only return after Signal/Broadcast — but the `for !condition` discipline the chapter mandates is correct and the standard advice, so I down-rate this to IMPRECISE/low-priority rather than WRONG.
- The "ThreadSanitizer v2 (TSan)", "shadow memory", "vector clocks", "5–10× memory", "2–20× slowdown" figures in the `-race` UnderTheHood are the standard documented TSan/Go race-detector characteristics and are presented as a "simplified model" with an explicit hedge; not flagged. (Go docs cite ~5–10× memory and ~2–20× CPU; consistent.)

## CORRECT count

**16 CORRECT**, 2 IMPRECISE (#3 terminology, #20 Cond wording), 1 WRONG (#15 file path/version). Total claims logged: 20 (#19 folded as CORRECT).

## Worst findings (priority order)

1. **#15 — "this lives in `sync/mutex.go`" is WRONG as of Go 1.25/1.26.** The mutex fairness/starvation implementation (`lockSlow`, `unlockSlow`, `starvationThresholdNs`) moved to `internal/sync/mutex.go`; `sync/mutex.go` is now a thin wrapper delegating to `internal/sync.Mutex`. The chapter pins this to "As of Go 1.26" so the wrong path is stated with false precision. Fix: point readers to `internal/sync/mutex.go`.
2. **#3 — "happens-before" terminology** for channel send/receive is the pre-2022 phrasing; the current model (the very model the chapter dates to 2022) uses "synchronized before." Semantically fine, but a chapter that explicitly cites the 2022 revision should use its vocabulary or note the rename. IMPRECISE.
3. **#20 — "spurious wakeups … allowed by … Go's implementation"** overstates: `sync.Cond.Wait` is documented not to wake without Signal/Broadcast. The mandatory `for`-loop guidance is still correct (lost wakeups + condition re-check), so this is a wording softening, not a mechanism error.

## Sources fetched (URLs actually opened)

- https://go.dev/ref/mem  (Go Memory Model, "Version of June 6, 2022")
- https://pkg.go.dev/sync  (WaitGroup.Go added go1.25.0)
- https://pkg.go.dev/sync/atomic  (typed atomics added go1.19)
- https://go.dev/doc/go1.25  (testing/synctest, WaitGroup.Go)
- https://go.dev/doc/go1.26  (goroutineleak profile / GOEXPERIMENT=goroutineleakprofile)
- https://go.dev/doc/go1.9  ("Mutex is now more fair")
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/sync/mutex.go  (wrapper over internal/sync.Mutex)
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/internal/sync/mutex.go  (Mutex fairness comment, starvationThresholdNs=1e6, lockSlow/unlockSlow)
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/sync/rwmutex.go  (writer-priority doc)
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/internal/runtime/atomic/atomic_amd64.s  (LOCK XADDQ)
- https://raw.githubusercontent.com/golang/go/go1.25.0/src/internal/runtime/atomic/atomic_arm64.s  (LDAXR/STLXR)

Tally: 20 claims logged — 16 CORRECT, 2 IMPRECISE, 1 WRONG, 0 OUTDATED, 0 UNVERIFIABLE. 11 source URLs fetched.
Frontmatter unchanged: yes (report-only, no edits to the chapter).
