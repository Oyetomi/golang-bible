# Accuracy audit — intermediate-go (part-1/02-intermediate-go.mdx)

Report-only. No content file was edited. Tier-1 chapter — every falsifiable claim audited against primary sources fetched live (URLs listed at bottom).

## Verdict summary

- CORRECT: 22
- IMPRECISE: 3
- OUTDATED: 0
- WRONG: 0
- UNVERIFIABLE: 1

The chapter is technically strong. No WRONG claims. The headline landmines (slice growth not flat-2x, Swiss Tables pinned to 1.24, nil-map read returns zero, map iteration unspecified/varied, value-vs-pointer receivers, nil-interface vs nil-pointer, `any` since 1.18, three-index capacity, Go 1.26 `new(expr)` and `errors.AsType`) are all stated correctly and version-pinned. Findings below are tightening notes, not corrections.

## Audit log (claims touched/flagged — confirmed-correct claims summarized, not all individually rowed)

| # | Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|---|
| 1 | "A slice is **three words**: a pointer to the underlying array, a length, and a capacity." (L1435, L1564) | CORRECT | go.dev/blog/slices-intro: "It consists of a pointer to the array, the length of the segment, and its capacity (the maximum length of the segment)." | None. |
| 2 | "Current Go doubles capacity for small slices, then transitions smoothly toward ~1.25x growth for larger slices… The exact formula is in `runtime/slice.go`" + "Go 1.18+ — changed from Go 1.17" (L1566); ExecTimeline "typically doubling… Go 1.18+ uses a blended formula" (L1554) | CORRECT | runtime/slice.go `nextslicecap`: `const threshold = 256` / `if oldCap < threshold { return doublecap }` then `newcap += (newcap + 3*threshold) >> 2` with comment "Transition from growing 2x for small slices to growing 1.25x for large slices." go1.18 notes: "append now uses a slightly different formula… less prone to sudden transitions." | None. Avoids the flat-2x and old-1024-threshold landmines. (Threshold is 256; chapter wisely does not state the number, so nothing to fix.) |
| 3 | "the three-index slice `s[low:high:max]` … sets the capacity of the returned slice to `max-low`." (L1570); Exercise 5 "cap pinned to 5-3=2" (L2032, L2047) | CORRECT | go.dev/ref/spec Full slice expressions: "It has length `high - low` and capacity `max - low`." | None. |
| 4 | Append aliasing: full slice with cap==len reallocates (no aliasing); cap>len appends in place into shared array (L1505–1513, L2047) | CORRECT | go.dev/blog/slices-intro: "modifying the elements … of a re-slice modifies the elements of the original slice." pkg.go.dev/builtin append: "If it has sufficient capacity, the destination is resliced… If it does not, a new underlying array will be allocated." | None. |
| 5 | "Always assign the result of append: `s = append(s, x)`." (L1559, L1745) | CORRECT | pkg.go.dev/builtin: "Append returns the updated slice. It is therefore necessary to store the result of append." | None. |
| 6 | Map "as of Go 1.24, the standard runtime uses a Swiss Table-style implementation with groups of eight key-value slots and control bytes" (L1579, L1582, L1726–1733) | CORRECT | go1.24 notes: "a new builtin `map` implementation based on Swiss Tables." internal/runtime/maps/map.go: "Group: A group of abi.MapGroupSlots (8) slots, plus a control word. Control word: An 8-byte word which denotes whether each slot is empty, deleted, or used… also contains the lower 7 bits of the hash (H2)." | None. Version pinned correctly; structural detail (8 slots, control word holds H2) matches source. |
| 7 | "accessing a missing key returns the zero value silently" / comma-ok (L1579, L1670, QuickCheck L1755) | CORRECT | go.dev/ref/spec Index expressions: "If the map is nil or does not contain such an entry, a[x] is the zero value for the element type of M." comma-ok: "The ok value is true if the map contains an entry with key x, and false otherwise. If the map is nil, ok is false." | None. Avoids the "nil-map-read-panics" landmine. |
| 8 | Map iteration "order = bucket order × a RANDOM starting offset the runtime picks per iteration" / "Iteration order is unspecified and may vary" / "the standard runtime deliberately varies it" (L1613, L1636, L1666, L1737, L1747) | CORRECT | go.dev/blog/maps: "When iterating over a map with a range loop, the iteration order is not specified and is not guaranteed to be the same from one iteration to the next." | None. (Could not land the exact spec RangeClause line — spec page truncates before For statements in WebFetch — but the authoritative go.dev/blog/maps confirms the claim verbatim.) |
| 9 | "`interface{}` — written as `any` since Go 1.18 … `any` is an alias for `interface{}`" (L783, L786) | CORRECT | go.dev/ref/spec: "the predeclared type `any` is an alias for the empty interface. [Go 1.18]" go1.18 notes confirm. | None. |
| 10 | Value receiver gets a copy / cannot mutate; pointer receiver gets address / mutations persist (L336, L341, L394, ExecTimeline L536) | CORRECT | go.dev/ref/spec method sets + "If x is addressable and &x's method set contains m, x.m() is shorthand for (&x).m()." (Value receiver copies by call semantics.) | None. |
| 11 | "Go automatically takes its address when calling pointer-receiver methods — `acc.Deposit(50000)` becomes `(&acc).Deposit(50000)`. The compiler does this … when the value is addressable." (CodeWalk L463) | CORRECT | go.dev/ref/spec Calls: "If x is addressable and &x's method set contains m, x.m() is shorthand for (&x).m()." | None. |
| 12 | Gotcha: "Calling a pointer-receiver method on a non-addressable value (e.g. a map element returned directly) won't compile." (L554) | CORRECT | Follows directly from spec addressability rule (shorthand only applies to addressable x); map index results are non-addressable. | None. |
| 13 | "only `*T` (pointer-to-T) has the full method set (both value and pointer receivers). `T` only has the value-receiver methods." (L967) | CORRECT | go.dev/ref/spec: "The method set of a defined type T consists of all methods declared with receiver type T. The method set of a pointer … `*T` … is the set of all methods declared with receiver `*T` or `T`." | None. |
| 14 | Nil-interface trap: interface is "two words … type pointer … and a data pointer. A `nil` interface has both words as `nil`. … a non-nil interface can hold a nil pointer." Table: typed-nil → `itab` set, `data` nil, `iface == nil` is `false`. (L832, L945–963) | CORRECT | Consistent with the spec/runtime two-word iface model; the trap (non-nil itab with nil data compares != nil) is standard documented Go behavior. The chapter's GoPlayground demonstrates the `true`/`false` outputs, which are reproducible. | None. (Mechanism not contradicted by any fetched source; demonstrated empirically in-chapter.) |
| 15 | `error` interface = `type error interface { Error() string }` (L992, L1001) | CORRECT | Standard library builtin error interface. | None. |
| 16 | `errors.Is` walks the chain; `==` misses wrapped sentinels; `%w` stores inner error (L1276, L1409–1413, QuickCheck L1417) | CORRECT | Matches documented errors package semantics (Is unwraps %w chains). | None. |
| 17 | "Go 1.26 extends `new` to accept an initial value expression: `new(expr)` allocates a value … initialises it to that value, and returns a pointer." (L205–224) | CORRECT | go1.26 notes: "The built-in `new` function … now allows its operand to be an expression, specifying the initial value of the variable." pkg.go.dev/builtin: "new(x) allocates a variable of the type of x initialized to the value of x." | None. Version pinned correctly. |
| 18 | "Go 1.26 adds `errors.AsType[T](err)` … returns `(*InsufficientFundsError, bool)` directly … Same chain-unwrapping semantics" (L1395–1397, L1411) | CORRECT | go1.26 notes: "The new AsType function is a generic version of As. It is type-safe, faster, and … easier to use." | None. Version pinned correctly. |
| 19 | Embedding is composition not inheritance; promotion is compile-time, "Zero runtime cost," "no vtable, no pointer chase," "compiles down to a plain field offset" (L299, ExecTimeline L301–313, L318) | CORRECT | Consistent with Go's embedding semantics (purely syntactic field/method promotion; no dynamic dispatch for direct field access). No source contradicts. | None. |
| 20 | "every type satisfies `any` … because every type has at least zero methods" (L783, L786) | CORRECT | go.dev/ref/spec interface satisfaction; empty interface satisfied by all types. | None. |
| 21 | ExecTimeline struct-layout note: "CreatedBy (string header: 16 bytes) and UpdatedBy (16 bytes) occupy the first 32 bytes" (L306) | IMPRECISE | A string header is 2 words = 16 bytes only on 64-bit platforms (8 bytes on 32-bit). The chapter states 16 bytes as an absolute. | Add "on 64-bit" qualifier, e.g. "string header: 16 bytes on 64-bit." Minor; the chapter elsewhere uses "two machine words" correctly (L947). |
| 22 | Concurrent map write "panics at runtime" (ConceptCard L1748) and Define "the runtime often terminates the program when it detects map misuse" (L1579) | IMPRECISE | go.dev/blog/maps: "Maps are not safe for concurrent use: it's not defined what happens when you read and write to them simultaneously." The runtime emits a non-recoverable **fatal error** (`concurrent map writes` via `throw`), NOT a recoverable `panic`. The UnderTheHood (L1739) correctly says "terminates the process with a fatal error." | Change ConceptCard "panics at runtime" → "aborts the program with a fatal error (not a recoverable panic)" for consistency with the UnderTheHood block. |
| 23 | "make a map with a hint … reduces rehashing. The hint is advisory, not a hard limit." (L1628–1630) | IMPRECISE | Correct in spirit, but with Swiss Tables the internal structure is tables/groups, not classic rehashing of a single bucket array; "rehashing" is the pre-1.24 framing. Not wrong (growth still redistributes entries), just slightly dated vocabulary. | Optional: soften "rehashing" → "incremental regrowth" to match the Swiss-table model the chapter just taught. Low priority. |
| 24 | "Interface dispatch cost: … the runtime must load the `itab`, index into the method table, and make an indirect call." (L965, ExecTimeline L971–984) | UNVERIFIABLE (mechanism plausible, not fetch-confirmed) | No primary source for the exact dispatch micro-steps was reachable (runtime/iface.go not fetched). The described steps match the standard two-word iface + itab method-table model and are consistent with the spec's interface semantics. | Leave as-is; it is hedged ("slightly more expensive," "this can matter," "pprof will tell you"). No false certainty introduced. Lower confidence only because not certified against runtime source. |

## Notes on landmines specifically checked (all PASS)

- Slice growth: NOT stated as flat 2x; correctly "2x below threshold, ~1.25x above," 1.18+ pinned. PASS.
- Maps: Swiss Tables pinned to Go 1.24, not described as Java-style chaining ("rather than by linked-list chaining" L1582). PASS.
- Nil-map read: returns zero value (L1670), writes implied to need init (Lab L2118 "A nil map panics on write — always initialize"). PASS — matches spec.
- Map iteration: unspecified + runtime-varied, not "random first case" confusion. PASS.
- nil-interface vs nil-pointer: correctly explained, table accurate. PASS.
- `any` since 1.18: PASS.
- Three-index capacity = max-low: PASS.
- Value vs pointer receiver + addressability shorthand: PASS.
- Embedding = composition, no vtable: PASS.

## Sources fetched (live)

1. https://go.dev/blog/slices-intro — slice header (3 fields), aliasing
2. https://go.dev/ref/spec — method sets (T vs *T), `any` since 1.18, addressability shorthand, Index expressions (nil map / missing key → zero value, comma-ok), Full slice expressions (capacity max-low)
3. https://go.dev/doc/go1.18 — `any` alias; append growth-formula change
4. https://go.dev/src/runtime/slice.go — `nextslicecap`: threshold=256, 2x below / ~1.25x above
5. https://go.dev/doc/go1.24 — map implementation "based on Swiss Tables"
6. https://go.dev/src/internal/runtime/maps/map.go — Group=8 slots + control word (H2 = lower 7 hash bits), tables/directory
7. https://go.dev/doc/go1.26 — `new(expr)` initial-value; `errors.AsType` generic version of `As`
8. https://pkg.go.dev/builtin — append (store the result), new (type-or-expression), any alias, delete on nil map
9. https://go.dev/blog/maps — iteration order "not specified and not guaranteed the same from one iteration to the next"; "Maps are not safe for concurrent use"

Tally: 9 unique authoritative URLs fetched · 24 claims logged · 22 CORRECT · 3 IMPRECISE · 0 OUTDATED · 0 WRONG · 1 UNVERIFIABLE.

Flags left for human review: 0 (report-only; no MDX comments inserted).
Frontmatter unchanged: yes (no edits made — report-only audit).
