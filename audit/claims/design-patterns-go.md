# Accuracy audit — design-patterns-go

Chapter: `content/part-1/13-design-patterns-go.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| `sync.WaitGroup.Go` is "new in Go 1.25"; "`wg.Go(func() { ... })` does both [Add(1) + start] in one call" (Callout + ExecTimeline + CodeWalk + ConceptGrid, used throughout) | CORRECT | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | none — version pin and mechanism are right. (The "calls Done() when the function returns" detail in some notes is consistent with the method's purpose.) |
| `sync.OnceValue`/`OnceFunc`/`OnceValues` are "Go 1.21" lazy-init helpers; "runs at most once and caches its result"; "OnceValues handles a (value, error) pair" | CORRECT | go.dev/doc/go1.21: "The new `OnceFunc`, `OnceValue`, and `OnceValues` functions capture a common use of `Once` to lazily initialize a value on first use." | none |
| Range-over-func / `iter.Seq` (= `func(yield func(V) bool)`) / `iter.Pull` are "Go 1.23"; `iter.Pull` "flips a push iterator into one you advance by hand", returns `next`/`stop`, `defer stop()` | CORRECT | go.dev/doc/go1.23: "The 'range' clause in a 'for-range' loop now accepts iterator functions … For details see the `iter` package." pkg.go.dev/iter: `type Seq[V any] func(yield func(V) bool)`; `func Pull[V any](seq Seq[V]) (next func() (V, bool), stop func())`; "Typically, callers should 'defer stop()'." | none — type, version, and Pull semantics all confirmed. |
| UnderTheHood (iter): "`iter.Pull(seq)` runs the push iterator on a **separate goroutine** and hands you `next()` and `stop()`." | IMPRECISE / UNVERIFIABLE | pkg.go.dev/iter documents Pull's *contract* (next/stop) but does not document it as running on a separate goroutine; that is an implementation detail. Pull is commonly implemented with a coroutine/goroutine, but the doc does not promise it. | Soften to "Pull lets you advance the sequence by hand (`next`/`stop`); internally it suspends/resumes the push iterator." Don't assert "separate goroutine" as a guarantee. Low risk — the observable behavior taught is correct. |
| UnderTheHood: "An interface value in Go is exactly **two machine words**: a pointer to the type descriptor (also called the itab for non-empty interfaces) and a pointer to the concrete data." + "method call … does one pointer indirection (itab → method pointer)" | CORRECT | research.swtch.com/interfaces (Russ Cox): "Interface values are represented as a two-word pair giving a pointer to information about the type stored in the interface and a pointer to the associated data." "The itable begins with some metadata … and then becomes a list of function pointers." | none |
| Typed-nil trap: "if you return a `*fakeGateway` that happens to be nil inside an interface, the interface value's type word is non-nil … so `err != nil` is `true`" | CORRECT | Standard Go semantics (interface non-nil when type word set even if data word nil); consistent with the two-word model above. | none |
| Bit-flag math: `Read = 1 << iota` ⇒ Read=1, Write=2, Execute=4; `&^` clears a bit | CORRECT | go.dev/ref/spec: `iota` increments per ConstSpec; `1<<0=1, 1<<1=2, 1<<2=4`. `&^` is the documented AND-NOT (bit-clear) operator. | none |
| Sealed sum type: an interface with an **unexported** method can only be satisfied by types in the declaring package | CORRECT | go.dev/ref/spec (method sets / exported identifiers): a type outside the declaring package cannot declare a method whose name is an unexported identifier of another package, so it cannot satisfy the interface. | none |
| Exercise 8 prose: "Premium's 2000 bps = 20% off … `1000 - 1000*2000/10000 = 800`" | CORRECT | Arithmetic: 2000/10000 = 0.20; 1000 − 200 = 800. | none |

## CORRECT (verified, not individually tabled)

Functional options (`Option func(*config)` mutating a private struct, last-write-wins, variadic apply loop) — pure language mechanics, matches spec. Accept-interfaces/return-structs, consumer-defined interfaces, `http.HandlerFunc` adapter, middleware `func(http.Handler) http.Handler` decorator chaining and reverse-order `Chain`, `errors.Is`/`errors.As`/`%w` unwrapping via `Unwrap()`, `sync.Once.Do` runs once, package-level var init-once, `Memoize[K comparable, V any]` generic decorator, `Set[T comparable] map[T]struct{}` (zero-size `struct{}` value), method values vs method expressions (`(*Account).Deposit` ⇒ `func(*Account, int64)`), self-referential option (`func(*T) Option` returning the undo). All consistent with go.dev/ref/spec and the stdlib package docs.

**CORRECT count (verified claims): ~22** (7 tabled CORRECT + ~15 swept).

## Worst finding

No WRONG or OUTDATED claims found. The most material item is **IMPRECISE/UNVERIFIABLE**: the UnderTheHood note asserting `iter.Pull` "runs the push iterator on a **separate goroutine**" — that is an undocumented implementation detail stated as fact. The observable `next`/`stop`/`defer stop()` contract taught alongside it is correct, so this is a low-risk over-precision, not a teaching error. This is the cleanest of the five audited chapters: every Go-version attribution (1.21 Once*, 1.23 iter, 1.25 WaitGroup.Go) checks out against the matching go.dev release note, and the interface two-word/itab model matches Russ Cox's canonical description.

## Sources fetched
- https://go.dev/doc/go1.25 (WaitGroup.Go)
- https://go.dev/doc/go1.21 (OnceFunc/OnceValue/OnceValues)
- https://go.dev/doc/go1.23 (range-over-func + iter package)
- https://pkg.go.dev/iter (Seq/Seq2/Pull signatures + stop() contract)
- https://research.swtch.com/interfaces (two-word interface value + itable)

## Tally
- Flagged rows: 9 (8 CORRECT-but-tabled; 1 IMPRECISE/UNVERIFIABLE to hedge)
- CORRECT (verified): ~22
- WRONG: 0 · OUTDATED: 0 · IMPRECISE: 1 (iter.Pull "separate goroutine") · UNVERIFIABLE: 1 (same row)
- Content file edited: NO (report-only)
