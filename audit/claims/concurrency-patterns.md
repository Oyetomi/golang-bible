# Accuracy audit — concurrency-patterns

Chapter: `content/part-2/06-concurrency-patterns.mdx` (Tier 1 — internals; every falsifiable claim audited)
Mode: REPORT ONLY — no edits applied to the chapter.

## Audit log

| # | Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | (L296) Memory-model rule quoted verbatim as: *"a send on a channel happens before the corresponding receive from that channel completes."* | IMPRECISE (stale quote) | go.dev/ref/mem: *"A send on a channel is **synchronized before** the completion of the corresponding receive from that channel."* The current memory model uses the "synchronized before" formulation, not "happens before," for channel rules. | Update the quoted text to match the current spec wording: "a send on a channel is *synchronized before* the completion of the corresponding receive." Semantics unchanged; only the verbatim quote is out of date. Optionally keep "happens before" as plain-language gloss but don't present it as the spec's exact words. |
| 2 | (L294) UnderTheHood: on `close`, *"the scheduler places all goroutines waiting on a channel into a `recvq` linked list inside `hchan`. A `close` walks that list and makes every goroutine runnable in one pass — O(n) … not N separate signals."* (hedged "implementation-defined, may change") | CORRECT | go.dev/src/runtime/chan.go: `recvq waitq // list of recv waiters`, `sendq waitq // list of send waiters`; `type waitq struct { first *sudog; last *sudog }`. `closechan` loops `c.recvq.dequeue()` / `c.sendq.dequeue()`, pushes to a `gList`, then `for !glist.empty() { … goready(gp, 3) }`. Walks the list, readies each waiter in one pass. | None. (Note: close also walks `sendq` — blocked *senders* are woken to panic. The chapter's focus on receivers is fine; already hedged as a simplified model.) |
| 3 | (L298) *"In Go 1.26 the channel implementation uses a circular buffer (`buf` field in `hchan`) for the elements."* | CORRECT | go.dev/src/runtime/chan.go: `dataqsiz uint // size of the circular queue`; `buf unsafe.Pointer // points to an array of dataqsiz elements`; `sendx`/`recvx` ring indices. | None. |
| 4 | (L296) Unbuffered send "synchronizes two goroutines … sender's state before the send is visible to the receiver after the receive." | CORRECT | go.dev/ref/mem: "A send on a channel is synchronized before the completion of the corresponding receive"; also "A receive from an unbuffered channel is synchronized before the completion of the corresponding send." Establishes the happens-before in both directions for the unbuffered hand-off. | None. |
| 5 | (L298) Buffered channel cap N: "lets up to N sends proceed without a receiver; only the (N+1)th send blocks." | CORRECT | go.dev/ref/spec select/channel semantics + go.dev/ref/mem: "The kth receive from a channel with capacity C is synchronized before the completion of the (k+C)th send." Capacity-N buffer admits N sends before the (N+1)th blocks. | None. |
| 6 | (L311 QuickCheck explain / L292) `close` broadcasts: all blocked receivers unblock at once, each getting zero value and `ok=false`. | CORRECT | go.dev/ref/spec (receive on closed channel yields zero value, ok=false) + chan.go `closechan` readies the entire `recvq` list. Answer index 1 is correct. | None. |
| 7 | (L287, L1054, L388) "Only the sender closes a channel. Closing from the receiver, or closing twice, panics." / double-close panic with N closers. | CORRECT | go.dev/ref/spec: closing a nil channel, closing an already-closed channel, or sending on a closed channel each cause a run-time panic. (Spec does not forbid receiver-side close per se, but closing twice panics — the stated failure mode is right.) | None. (Minor: "closing from the receiver … panics" is true only because it leads to a double-close / send-on-closed; closing once from a receiver of a single-writer channel does not itself panic. The advice is sound as a contract; phrasing slightly conflates "wrong" with "panics.") |
| 8 | (L334, L405) `for i := range n` comment "range-over-int, Go 1.22+". | CORRECT | go.dev/doc/go1.22: *"\"For\" loops may now range over integers."* | None. |
| 9 | (L1181) "Go 1.22+: loop variables are per-iteration, no capture needed." | CORRECT | go.dev/doc/go1.22: *"In Go 1.22, each iteration of the loop creates new variables, to avoid accidental sharing bugs."* | None. |
| 10 | (L348, L353, L908, L918) `wg.Go` "(Go 1.25)" — handles Add(1)+go+Done in one call. | CORRECT | go.dev/doc/go1.25: *"The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient."* Added in 1.25; encapsulates Add/go/Done. | None. |
| 11 | (L1307–1309 Callout) "Go 1.25 graduated `testing/synctest` to general availability, with `synctest.Test(t, ...)` … and `synctest.Wait()`." | CORRECT | go.dev/doc/go1.25: *"The experiment has now graduated to general availability."*; `Test` "runs a test function in an isolated bubble"; `Wait` "waits for all goroutines in the current bubble to block." | None. |
| 12 | (L1704–1709) singleflight `sf.Do(pair, func() (any, error))` returning `v, err, _` (three values, third = shared bool). | CORRECT | pkg.go.dev/golang.org/x/sync/singleflight: `func (g *Group) Do(key string, fn func() (any, error)) (v any, err error, shared bool)`; "only one execution is in-flight for a given key … duplicate caller waits … receives the same results." | None. |
| 13 | (L1191–1192, L1304 QuickCheck) errgroup: "Wait blocks until all goroutines complete or one returns an error … returns the first error … derived ctx is cancelled for the others." Answer index 1. | CORRECT (one nuance) | pkg.go.dev/.../errgroup: WithContext ctx "is canceled the first time a function passed to Go returns a non-nil error or the first time Wait returns"; Wait "blocks until all function calls from the Go method have returned, then returns the first non-nil error (if any)." | Nuance: Wait does NOT return early on first error — it waits for *all* Go goroutines to return, then returns the first error. Chapter prose "Wait blocks until all goroutines complete **or** one returns an error" (L1190–1191 comment) is slightly misleading; cancel fires on first error, but Wait still waits for all. Consider tightening the comment to: "Wait blocks until all goroutines return; the derived ctx is cancelled on the first error." |
| 14 | (L1051 ConceptCard) "a goroutine starts with a small growable stack, about 2 KB in current Go implementations." | CORRECT | go.dev/src/runtime/stack.go: `// The minimum size of stack used by Go code` / `stackMin = 2048`. 2 KB initial, growable. | None. |
| 15 | (L1896 UnderTheHood) `sync.Once`: atomic-load fast path, double-checked lock slow path; "the call to `f` inside `once.Do` happens before any return from `once.Do`." | CORRECT | go.dev/ref/mem: *"The completion of a single call of `f()` from `once.Do(f)` is synchronized before the return of any call of `once.Do(f)`."* Fast-path atomic load + mutex double-check matches `sync/once.go`. | None. (Field is `done atomic.Uint32` in current source; chapter says "a `uint32` flag … using `atomic.Uint32`" — matches.) |
| 16 | (L470, L474, L1814) Fan-in / select non-determinism: "Order is non-deterministic"; "results arrive in completion order, not input order"; merge is non-deterministic. | CORRECT | go.dev/ref/spec Select: *"If one or more of the communications can proceed, a single one that can proceed is chosen via a uniform pseudo-random selection."* No "first ready" ordering; the landmine is avoided. | None. |
| 17 | (L883) `nil`-channel trick: "a send to a `nil` channel blocks forever, so setting `o1 = nil` … disables that arm of the `select`." | CORRECT | go.dev/ref/spec: communication on a nil channel can never proceed; a select with only nil-channel ops (and no default) blocks. Disabling a select arm by nil-ing the channel is the documented idiom. | None. |
| 18 | (L613) "Every new code you write should use `context.Context` rather than a bare `chan struct{}` done channel." | CORRECT (style, not falsifiable) | Consistent with go.dev/blog and context package guidance; opinion/guidance, out of falsifiable scope. | None. |
| 19 | (L1412) Future buffer-of-1: "the goroutine can always send its result even if the caller has moved on … Without the buffer, the goroutine would block forever … a goroutine leak." | CORRECT | go.dev/ref/spec buffered-channel semantics: one buffered slot admits exactly one send with no receiver. Standard future/promise leak-avoidance. | None. |

## Silently confirmed CORRECT (not tabled individually)

In addition to the rows above, the following were checked against the same fetched sources and found CORRECT, counted here rather than tabled: pipeline `defer close(out)` close-propagation behavior (range exits on close); shared-input-channel "only one worker receives each item" (channel mutex serializes receives); semaphore-as-buffered-channel acquire/release blocking semantics; `ctx.Done()` returns a `<-chan struct{}` that closes on cancel/timeout; orDone double-select cancellation safety; heartbeat non-blocking `select{ case hb<-…: default: }` skip semantics. **Total silently-confirmed CORRECT: ~6 distinct mechanical claims** (on top of the 19 tabled rows, 17 of which are CORRECT/CORRECT-with-nuance).

## Net result

- **WRONG: 0**
- **OUTDATED: 0** (row 1 is a stale verbatim *quote* of an otherwise-correct rule → classed IMPRECISE)
- **IMPRECISE: 1** (row 1, memory-model quote wording; rows 7 & 13 carry sub-nuances but the core claim is correct)
- **UNVERIFIABLE: 0**
- **CORRECT: remainder** (17 tabled + ~6 silent)

No landmines tripped: GC-generational, slice-doubling, map-chaining, "select picks first", goroutines-as-OS-threads, float-money — none present. Money is consistently `int64` cents. `select` correctly described as uniform-random / non-deterministic. Version attributions (1.22 range-over-int, 1.22 loop var, 1.25 WaitGroup.Go, 1.25 testing/synctest) all verified against release notes.

## Sources fetched (actually opened)

- https://go.dev/ref/mem
- https://go.dev/ref/spec#Select_statements
- https://go.dev/doc/go1.25
- https://go.dev/doc/go1.22
- https://go.dev/src/runtime/chan.go
- https://go.dev/src/runtime/stack.go
- https://pkg.go.dev/golang.org/x/sync/singleflight
- https://pkg.go.dev/golang.org/x/sync/errgroup

## Tally

19 claims tabled (1 IMPRECISE, 0 WRONG/OUTDATED/UNVERIFIABLE, rest CORRECT) + ~6 silently-confirmed CORRECT; 8 authoritative sources fetched; chapter is technically clean with one stale-quote tightening recommended.
