# Technical Accuracy Audit — Editor Guide

You are doing a **deep technical-accuracy audit** of ONE already-written chapter. This is NOT the prose proofread (that's `_PROOFREAD_AND_MODERNIZE.md`, already done). This pass hunts **one specific failure**: a claim about how Go *actually works* stated with confidence and quietly **wrong**. Internals, numbers, mechanics. The kind of error that hands the reader a clean, confident, incorrect mental model — worse than teaching nothing.

You EDIT the file in place. Surgical. Don't rewrite, don't touch the voice, don't restructure.

---

## The cardinal rule (this is the whole point)

This course was written by an LLM. You are an LLM. If you "verify" internals **from memory**, you reproduce the exact same blind spots that put the error there — correlated failure, zero new signal. So:

> **You may not certify a falsifiable mechanical or numeric claim from memory.
> Open the primary source (WebFetch), confirm it, or downgrade the claim.**

A claim you can't back with a source you actually fetched is not "probably fine" — it's **unverified**, and you treat it as a defect (downgrade its confidence). This rule is what makes this pass worth running. Skip it and you've done nothing.

---

## What counts as a "falsifiable claim"

Anything that could be checked against the spec, the runtime source, or an authoritative doc and come back **false**:

- **Numbers** — "the GC keeps pauses under 1ms", "buckets hold 8 entries", "slices double until 1024", "every 61st tick", "GOMAXPROCS defaults to the CPU count", struct sizes, alignment, default `GOGC=100`.
- **Mechanisms** — "the scheduler does X then Y", "channels copy through the buffer", "generics are monomorphized like Rust", "the GC is generational", "maps use chaining".
- **Version attributions** — "new in 1.21", "loop vars fixed in 1.22", "Swiss Table maps since 1.24". Wrong version = wrong.
- **Guarantees** — "this is safe without a mutex", "happens-before holds here", "select picks the first ready case", "nil map reads panic".
- **Cause/effect in a scenario** — "this goroutine speeds up the I/O", "the mutex protects this" (when nothing's shared).

Prose, opinion, persona, analogies = **out of scope** here. You're after statements with a truth value.

---

## Risk-ranked targets

Audit effort follows risk. These chapters carry the most load-bearing internals — spend the budget here:

**Tier 1 — internals, audit every claim (`WebFetch` the source for each):**
- `part-2/go-scheduler-gmp` — GMP, work-stealing, sysmon, preemption, the 61st-tick global-runq check, GOMAXPROCS default
- `part-2/concurrency-patterns`, `part-2/advanced-concurrency-correctness` — memory model, happens-before, race semantics
- `part-1/concurrency` — goroutines vs threads (M:N), channel mechanics, `select` semantics
- `part-1/generics` — GC-shape stenciling + dictionaries (NOT full monomorphization)
- `part-2/performance-engineering` — GC, escape analysis, allocations, `defer` cost, inlining
- `part-1/data-semantics`, `part-1/intermediate-go` — slice growth, map internals, string/byte/rune, value vs pointer, interface layout

**Tier 2 — correctness-critical, audit the load-bearing claims:**
- All of Part 3 (money/ledger/consistency/idempotency) — these are *conceptual* correctness, not runtime internals. Check against the consistency/distributed-systems canon, not the Go spec.
- `part-1/testing`, `part-1/test-driven-development`, `part-2/reliability-patterns`, `part-2/time-clocks-timers`

**Tier 3 — light sweep, only obvious internals claims:**
- Project chapters, appendix/DSA, the higher-level/architecture chapters. Mostly application code; flag only confident-wrong internals if you see them.

---

## Source map — what to check against (fetch these, don't recall them)

| Topic | Authoritative source (WebFetch) |
|-------|--------------------------------|
| Language semantics, zero values, conversions, `select`, `range` | `go.dev/ref/spec` |
| Concurrency guarantees / happens-before | `go.dev/ref/mem` (the Go Memory Model — definitive) |
| GC behavior, GOGC, GOMEMLIMIT, pacing | `go.dev/doc/gc-guide` |
| Scheduler (GMP, work-stealing, sysmon) | `go.dev/src/runtime/proc.go` + Vyukov "Scalable Go Scheduler" design doc |
| Channels (`hchan`, sudog queues, direct send) | `go.dev/src/runtime/chan.go` |
| Maps (Swiss Tables since 1.24, buckets, load factor) | `go.dev/src/runtime/map.go` (and `map_swiss` / `internal/runtime/maps`) |
| Generics implementation | `go.dev/blog/intro-generics` + "Generics implementation: GC Shapes" design doc |
| What's new / version attribution | `go.dev/doc/go1.24`, `go1.25`, `go1.26`, and `go.dev/doc/devel/release` |
| Money / consistency / idempotency / exactly-once | standard distributed-systems concepts; for currency, integer-minor-unit convention |

If WebFetch can't reach a source, say so in the log and **downgrade** the claim rather than passing it.

---

## Known landmines — flag on sight

These are wrong-in-LLM-output often enough to grep for. If the chapter states any of these as written, it's almost certainly a defect:

- ❌ "Go's GC is **generational**." → It is **non-generational**, concurrent tri-color mark-sweep, non-compacting. (The 1.25 *Green Tea* GC is an opt-in experiment — don't describe it as the default, and don't call the default generational.)
- ❌ "Go **monomorphizes** generics like C++/Rust." → **GC-shape stenciling + runtime dictionaries**: one instantiation shared per GC shape (all pointer-shaped types share one), not one per concrete type. Not boxing either.
- ❌ "Slices always **double**." → 2× below a threshold (~256 elements), then grows ~1.25× via a smoothing formula (since 1.18). Don't state a flat 2× or the old 1024 threshold.
- ❌ "Maps use **chaining** like Java." → Since **Go 1.24** the map is a **Swiss Table** (`internal/runtime/maps`). Before that, bucketed (8 slots + overflow), still not linked-list chaining. Pin the version.
- ❌ "Goroutines are **OS threads**." → **M:N** — many goroutines multiplexed onto OS threads (M) over logical processors (P).
- ❌ "GOMAXPROCS defaults to the **number of CPUs**." → Since **Go 1.25** it's **container-aware** (respects cgroup CPU quota), so on a limited container it can be *less* than the machine's CPU count. Pin it.
- ❌ "`defer` is **slow/expensive**." → **Open-coded defers** since 1.14 make the common case nearly free; only defers in loops / non-static counts pay.
- ❌ "Reading a **nil map panics**." → Reads from a nil map return the zero value; **writes** panic.
- ❌ "Go strings are **guaranteed valid UTF-8**." → A string is an immutable byte sequence; UTF-8 is the *source/convention*, not a runtime guarantee. `range` decodes UTF-8; bytes can be arbitrary.
- ❌ "`select` picks the **first** ready case." → Among multiple ready cases it chooses **uniformly at random**.
- ❌ "**Exactly-once** delivery." (Part 3) → True exactly-once *delivery* is generally impossible over a network; what you build is **at-least-once + idempotent processing** = *effectively-once*. The chapter must frame it that way.
- ❌ Money as **float** anywhere. → Integer minor units (cents), or a decimal type. Never `float64` for money.

This list isn't exhaustive — it's the high-frequency set. New confident numbers you can't source get the same skepticism.

---

## Procedure (per claim)

1. **Extract** the falsifiable claim. (Internals, number, mechanism, version, guarantee.)
2. **Classify confidence** — is it stated as hard fact, or already hedged ("roughly", "as of 1.26")? Hard-fact claims need hard sources.
3. **Verify** — WebFetch the matching source from the map. Find the line that confirms or refutes. **Quote it in your log.** No fetch, no certification.
4. **Verdict:**
   - **CORRECT** — source confirms. Leave it.
   - **IMPRECISE** — true-ish but sloppy/misleading. Tighten or hedge.
   - **OUTDATED** — was true, changed in a later Go version. Modernize + pin the version.
   - **WRONG** — source refutes. Fix it.
   - **UNVERIFIABLE** — no source found / fetch failed. **Downgrade**: soften the confident phrasing ("implementation-defined", "roughly", "as of Go 1.26 this is the case") so the reader isn't handed false certainty.
5. **Act:**
   - Fixable with confidence → edit in place.
   - WRONG but you're not certain of the *right* answer → **do not guess**. Leave an MDX flag comment exactly where it is: `{/* ACCURACY: claim "<X>" looks wrong vs <source> — needs human check */}` and note it in the log.
   - Keep the edit minimal. Don't rewrite the surrounding paragraph or change the persona.
6. **Version-pin** any internals claim that doesn't already name its Go version (baseline Go 1.26). Behavior that changed → name the version it changed in.
7. **`<ExecTimeline>` / `<Scene>` internals animations** — verify the *steps* match reality (e.g. a scheduler animation's order of operations, a GC animation's phases). A pretty animation of a wrong mechanism is the worst case. If it abstracts real complexity, that's fine — but it must not be *wrong*; add a one-line "simplified" note if needed.

---

## MDX safety (these break the build — never introduce them)

- No backslash-escaped quotes inside double-quoted JSX attributes — use brace + JS string: `question={'… "x" …'}`.
- No bare Go brace-syntax in prose/JSX text — `interface{...}`, `struct{...}`, `map[T]struct{}`, a bare `{word}` — backtick them or fence them. (Inside a JS string prop value they're fine.)
- `<GoPlayground>` wraps a fenced ` ```go ` block as its child. gofmt, real tabs. Stdlib-only, compiles under `go run` (Codapi runs `go run` only — no `go test`/`-race`/bench/fuzz).
- No `import`/`export` lines. Don't touch frontmatter — it must keep matching `_manifest.json`. `<Callout>` `kind` ∈ {note, warn, pro, tip, advanced}.
- MDX comments `{/* ... */}` are legal — use them for `ACCURACY:` flags.

---

## Output

Edit ONLY your assigned chapter file. Then reply with an **audit log**, one row per claim you touched or flagged — not the ones you confirmed silently. Format:

```
## Accuracy audit — <slug>

| Claim (as written) | Verdict | Source | Action |
|---|---|---|---|
| "Go's GC is generational" | WRONG | go.dev/doc/gc-guide: "non-generational" | Fixed → "non-generational concurrent mark-sweep" |
| "GOMAXPROCS defaults to NumCPU" | OUTDATED | go.dev/doc/go1.25 | Fixed → "container-aware since 1.25" |
| "pauses under 1ms" | UNVERIFIABLE | (no hard source) | Downgraded → "typically sub-millisecond, workload-dependent" |

Sources fetched: <list the URLs you actually opened>
Flags left for human review: <count + slugs of {/* ACCURACY */} comments>
Frontmatter unchanged: yes
```

If you fetched **zero** sources, you did the pass wrong — go back and fetch. The deliverable is *verified* claims, not re-read ones.
