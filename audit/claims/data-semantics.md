# Accuracy audit — data-semantics

Chapter: `content/part-1/03-data-semantics.mdx`
Mode: REPORT ONLY (no edits applied). Tier-1 chapter — audited every falsifiable claim.

This chapter is unusually clean. It is a value/pointer-semantics + struct-alignment + data-oriented-design chapter and it stays inside the part of Go that is spec-guaranteed and easy to verify empirically. Every concrete struct-size number was recompiled with a real Go toolchain (go1.24.0) and every one matched. No WRONG findings. A handful of IMPRECISE / UNVERIFIABLE phrasings around cache behavior and a version-pin nuance on the Green Tea GC.

## Audit log

| # | Claim (as written) | Verdict | Source (fetched) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | "In Go, **assignment copies.** … Go copies every byte of `a` into `b`. They share nothing." | CORRECT | go.dev/ref/spec, "Representation of values": "Values of predeclared types, arrays, and structs are **self-contained: Each such value contains a complete copy of all its data**." | none |
| 2 | Value receiver = copy, pointer receiver = original; method set of `*T` includes `T` and `*T` methods; mixing breaks interface satisfaction | CORRECT | go.dev/ref/spec, Method declarations + Method sets: "The method set of a pointer to a defined type `T` … is the set of all methods declared with receiver `*T` or `T`." | none |
| 3 | `unsafe.Sizeof` "returns the actual in-memory size of a type including all padding … a compile-time operation — no runtime cost." | CORRECT | pkg.go.dev/unsafe: "For a struct, the size includes any padding introduced by field alignment." + "The return value of Sizeof is a Go constant if the type … does not have variable size." | none |
| 4 | `unsafe.Offsetof` "gives the byte offset of a specific field"; `unsafe.Alignof` "gives the alignment requirement." | CORRECT | pkg.go.dev/unsafe: Offsetof "returns the number of bytes between the start of the struct and the start of the field"; Alignof "the largest value m such that the address of v is always zero mod m." | none |
| 5 | "Go **guarantees the field layout** — the fields … appear in memory in exactly the order you declared them, with padding inserted between fields … it is never permitted to reorder." | CORRECT | pkg.go.dev/go/types#Sizes (StdSizes/Offsetsof follows "the gc compiler's layout"): "Fields are laid out **in declaration order** with **padding inserted as needed**." Empirically reproduced (offsets match declaration order). Note: spec's own "Size and alignment guarantees" appendix was unreachable (WebFetch truncates the single-page spec; see Unverifiable note). | none — corroborated by go/types + empirical test |
| 6 | Alignment table: bool/int8/uint8/byte = size 1 align 1; int16/uint16 = 2/2; int32/uint32/float32/rune = 4/4; int64/uint64/float64/complex64/ptr/uintptr = 8/8; int/uint = native word (8 on 64-bit); struct align = max field align; struct size padded to multiple of its align; array align = element align; interface = two words | CORRECT (bit-widths) / well-formed | go.dev/ref/spec Numeric types: uint8…uint64 are 8/16/32/64-bit; "uint either 32 or 64 bits, int same size as uint, uintptr large enough to store a pointer." go/types confirms struct align = max, total size padded. complex64 = two float32 = 8 bytes, align 8 on these arches. | none. (Minor: align/size are architecture-defined, but the chapter already scopes this with "in practice on amd64 (and arm64)".) |
| 7 | `TransactionPadded` (bool, int64, int64) = **24**; `TransactionPacked` = **24** | CORRECT | Recompiled (go1.24.0): both 24. | none |
| 8 | `WastefulEvent` = **40**; `EfficientEvent` = **24** (and the "16 MB saved over 1M events" → 16 bytes × 1e6) | CORRECT | Recompiled: 40 and 24. Δ = 16 bytes/elem × 1e6 = 16 MB. | none |
| 9 | ExecTimeline byte-offset walks: Wasteful → Flag1@0, pad 1–7, Amount@8, Flag2@16, pad 17–23, Count@24, Flag3@32, pad → 40. Efficient → Amount@0, Count@8, Flag1@16, Flag2@17, Flag3@18, pad 19–23 → 24. | CORRECT | Recompiled offsets reproduce exactly this layout. | none |
| 10 | QuickCheck: struct {A bool; B int64; C bool; D int64} = **32 bytes** ("A(1)+7pad+B(8)+C(1)+7pad+D(8)"); reordered B,D,A,C = 24 | CORRECT | Recompiled: 32. | none |
| 11 | `TransactionAoS` (ID int64, Amount int64, Currency [3]byte, Approved bool) = **24**, "4 bytes trailing pad" | CORRECT | Recompiled: 24; Currency@16, Approved@19, 4 bytes trailing pad. | none |
| 12 | `Money` (int64 + [3]byte) "≤ 16 bytes" / "= 16" with "5 bytes trailing pad" | CORRECT | Recompiled: 16. | none |
| 13 | Lab: struct as written = 40; winning layout (two int64, then [3]byte, then three bools) = 24; "22 bytes of data, padded to 24" | CORRECT | Recompiled: as-written 40, packed 24. ID@0, Amount@8, Currency@16(3), 3 bools @19/20/21 = 22 data, padded to 24. | none |
| 14 | Exercise 3 `OrderEventBad` (bool,int64,bool,int64,byte) = 40; packed = 24 | CORRECT | Recompiled: 40 and 24. | none |
| 15 | "`golangci-lint` ships `fieldalignment`" + analyzer "flags structs where reordering would shrink them" + install path `golang.org/x/tools/go/analysis/passes/fieldalignment/cmd/fieldalignment` + `-fix` | CORRECT | pkg.go.dev/golang.org/x/tools/.../fieldalignment: "defines an Analyzer that detects structs that would use less memory if their fields were sorted." Part of golang.org/x/tools. (`-fix` is supported by the analysis driver; the standalone `cmd/fieldalignment` accepts `-fix`.) | none — accurate. (Pedantic: `fieldalignment` is wired into golangci-lint via the `govet`/`fieldalignment` settings rather than on by default, but "ships" is fair.) |
| 16 | "Go 1.26 … made the Green Tea GC the **default**; its overhead reduction is workload-dependent" (UnderTheHood, line 308) and "Go 1.26 made the Green Tea GC the default collector, improving locality and scalability for marking/scanning many small objects" (line 721) | CORRECT | go.dev/doc/go1.26: "The Green Tea garbage collector, previously available as an experiment in Go 1.25, **is now enabled by default** … expect somewhere between a 10–40% reduction in garbage collection overhead in real-world programs that heavily use the garbage collector." Opt-out: `GOEXPERIMENT=nogreenteagc`. | none — correctly pinned to 1.26 and correctly framed as default + workload-dependent. (This is the landmine the audit guide warns about; chapter gets it right.) |
| 17 | "Go 1.25/1.26 … the compiler stack-allocates slice backing stores in more situations than before, reducing heap escapes" (lines 308, 717) | CORRECT | go.dev/doc/go1.25: "The compiler can now allocate the backing store for slices on the stack in more situations, which improves performance." Reaffirmed in go.dev/doc/go1.26 with the same wording. Attributing it to **both** 1.25 and 1.26 is accurate (introduced 1.25, present in 1.26). | none |
| 18 | "Every goroutine starts with a small stack (about **2 KB** in current Go implementations) that grows dynamically." | CORRECT | go.dev/src/runtime/stack.go: `// The minimum size of stack used by Go code` `stackMin = 2048`. Chapter correctly hedges ("about", "current Go implementations") since the actually-allocated fixedStack rounds up and adds stackSystem. | none |
| 19 | Escape triggers: `return &x`; storing a pointer in a slice/map that outlives the fn; passing to `any` (may box on heap); passing to a goroutine closure | CORRECT (conceptually; impl-defined) | Consistent with escape-analysis behavior; chapter correctly hedges "may box" and routes the authoritative treatment to Part 2 + `-gcflags=-m`. No single primary doc enumerates these, but each is standard and not overstated. | none |
| 20 | "A modern CPU L1 cache line is **commonly 64 bytes**" / "typically 8 bytes on 64-bit systems" (word size) | CORRECT (appropriately hedged) | go.dev/src/internal/cpu/cpu.go: "CacheLineSize is the CPU's assumed cache line size. There is currently no runtime detection of the real cache line size so we use the constant per GOARCH CacheLinePadSize as an approximation." The "commonly/typically" hedging is exactly right — 64 B is the amd64/arm64 assumption, not a universal guarantee. | none |
| 21 | "each 64-byte CPU cache line loads about **2-3** TransactionAoS values" (24-byte struct); Define says "~2 full structs" | IMPRECISE (but defensible) | Arithmetic: 64/24 = 2.67. A cache-line load that is not 24-aligned straddles boundaries, so on average a scan touches ~2.67 structs per line; "2-3" and "~2" are both within range. The two phrasings ("2-3" vs "~2") are mildly inconsistent with each other. | Optional: harmonize to "~2–3 structs per line." Not a defect. |
| 22 | "33% cache utilization … 100% utilization … Same algorithm, **3x the throughput**" (AoS 8/24 vs []int64 8/8) | IMPRECISE | 8/24 = 33% bytes-useful and 24/8 = 3× is the memory-traffic ratio, not a guaranteed throughput ratio (prefetch, hardware streaming, and compute can hide latency). The chapter itself elsewhere hedges this as "often 2–5×" (Exercise 4) and "10–50×" (pointer-chained). The bare "3x the throughput" in the CodeWalk note is the only place it's stated as a hard outcome. | Optional soften: "up to ~3× less memory traffic" rather than "3x the throughput." Bytes-utilization numbers themselves are correct. |
| 23 | "A fraud detection pipeline scanning 1M records can be **10–50× faster** with contiguous layout vs. pointer-chained" | UNVERIFIABLE (plausible, hedged with "can be") | No primary source certifies a 10–50× figure; it is workload/hardware-dependent. Pointer-chasing across scattered heap allocations genuinely can cost an order of magnitude+ vs a sequential scan, so the range is plausible and the phrasing is hedged ("can be"). | Leave as-is given the hedge, or add "(workload-dependent)". Not asserting a hard guarantee, so acceptable. |
| 24 | "passing by value is often *faster* than passing a pointer" for small non-escaping structs (registers/stack, no indirection, no heap round-trip) | CORRECT (well-hedged) | Consistent with Go's register-based ABI (regabi) and escape analysis; chapter says "often" and "Profiler first — never guess," so no hard guarantee is made. | none |
| 25 | Value/pointer Scene + the two ExecTimelines (copy → caller unaffected; pointer → caller mutated; 8-byte pointer) | CORRECT | go.dev/ref/spec value-copy semantics (claim 1) + pointer is one machine word (8 bytes on 64-bit, per Numeric types). Animation steps match real call semantics. | none |

## Notes on the one UNVERIFIABLE source-access issue (not a chapter defect)

- The Go spec's **"Size and alignment guarantees"** appendix (the canonical statement that `unsafe.Alignof` is "at least 1", struct align = largest field align, array align = element align) could **not be fetched**: `go.dev/ref/spec` is a single very long HTML page and WebFetch truncated it before the appendix on every attempt (returned `TRUNCATED` when asked to isolate that subsection). I substituted three independent confirmations: (a) `pkg.go.dev/go/types#Sizes` (declaration-order layout + padding, "gc compiler's layout"); (b) `pkg.go.dev/unsafe` (Sizeof includes padding, Alignof definition); (c) direct empirical recompilation of every struct in the chapter with go1.24.0. All agree with the chapter. So the underlying claims are verified even though the single most authoritative paragraph was not directly quotable here.

## Tally

- Claims audited: 25
- **CORRECT: 21**
- IMPRECISE: 2 (#21 cache-lines-per-line wording; #22 "3x the throughput")
- UNVERIFIABLE: 1 (#23 "10–50× faster" — hedged, plausible, no hard source)
- WRONG: 0
- OUTDATED: 0
- Flags left for human review: 0 (report-only; nothing rises to a required fix)
- Frontmatter unchanged: yes (no edits made)

## Sources fetched (URLs actually opened)

1. https://go.dev/ref/spec  (Representation of values; Method declarations; Numeric types — confirmed value-copy semantics, method sets, integer bit-widths, int/uint/uintptr)
2. https://go.dev/ref/spec#Numeric_types
3. https://pkg.go.dev/unsafe  (Sizeof/Offsetof/Alignof semantics + Go-constant status)
4. https://pkg.go.dev/go/types#Sizes  (StdSizes: declaration-order layout + padding, gc compiler layout)
5. https://go.dev/doc/go1.26  (Green Tea GC now default; slice backing-store stack allocation)
6. https://go.dev/doc/go1.25  (slice backing-store stack allocation introduced; Green Tea GC opt-in experiment)
7. https://go.dev/src/runtime/stack.go  (stackMin = 2048 → ~2 KB starting stack)
8. https://go.dev/src/internal/cpu/cpu.go  (CacheLineSize is an assumed/approximated per-GOARCH constant, no runtime detection)
9. https://pkg.go.dev/golang.org/x/tools/go/analysis/passes/fieldalignment  (analyzer "detects structs that would use less memory if their fields were sorted")
10. https://go.dev/blog/strings  (strings immutable/arbitrary bytes/range decodes UTF-8 — cross-check; chapter makes no string claims)

One-line tally: 25 claims audited, 21 CORRECT, 2 IMPRECISE, 1 UNVERIFIABLE, 0 WRONG/OUTDATED — every concrete struct-size number empirically reproduced; Green Tea-GC-default and slice-stack-alloc version pins all verified accurate.
