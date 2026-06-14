# Accuracy audit — part-1/05-generics

Tier-1 chapter (generics implementation). Report-only; no edits applied to the content file.

## Critical finding (the assigned landmine)

The chapter's central "Under the Hood" mechanism is **wrong about the gcshape grouping rule**. It repeatedly states that types share a stencil when they have the **same size + same pointer layout** (e.g. "int and int64: same size (8 bytes on amd64), no pointers → SAME GC shape → ONE stencil serves both"). The Go 1.18 design doc states the rule is **same *underlying type*, OR both pointer types** — *not* same size. `int` and `int64` have different underlying types and are therefore in **different** gcshapes; they do **not** share a stencil. The doc is explicit: "fundamentally different built-in types such as `int` and `float64` are never in the same gcshape" and "`int16` and `int32` have distinct gcshapes." The all-pointers-share-one-shape claim is correct; the size-based scalar grouping is the error.

## Audit log

| Claim (as written) | Verdict | Source | Proposed fix (NOT applied) |
|---|---|---|---|
| Scene (line ~1389): "int and int64: same size (8 bytes on amd64), no pointers → SAME GC shape → ONE stencil serves both." | **WRONG** | generics-implementation-dictionaries-go1.18: "Two concrete types are in the same gcshape grouping if and only if they have the same underlying type or they are both pointer types"; "fundamentally different built-in types such as int and float64 are never in the same gcshape." int and int64 have *different* underlying types → different gcshapes. | Replace the int/int64 pairing with two types that share an *underlying type*, e.g. `int` and `type Cents int` (or `int64` and `type Timestamp int64`). The grouping criterion is "same underlying type," not "same byte size." |
| "Two types share a GC shape if: 1. They have the same size in bytes, AND 2. They have the same pointer layout" (line ~1437) | **WRONG** | Same source — rule is "same underlying type OR both pointer types." Same size is necessary but not sufficient (int vs int64 vs float64 are all 8 bytes, all distinct gcshapes). | Restate: "Two non-pointer types share a GC shape iff they have the same *underlying type*. Separately, all pointer-shaped types share one shape." Drop the size-based definition. |
| "All `int`-sized types share a GC shape: `int`, `int64`, `Cents`, `Dollars`." (line ~1442) | **WRONG** | Same source. Only `int`+`Dollars`/`Cents` (if defined `type Cents int`) share — they share underlying type `int`. `int64` is a *different* underlying type → different gcshape. | Fix to: "`int` and any `type X int` share a shape; `int64` and any `type Y int64` share a *different* shape." |
| ExecTimeline ① (line ~1487): "GC shape of Cents = int64 shape … Matches the int64 GC shape group" and dict `compareFn = int64_less` for Cents | **WRONG** | Same source. `type Cents int` has underlying type `int`, not `int64`; it groups with `int`, not `int64`. | Relabel "int64 shape" → "int shape"; the example already (correctly) reuses the stencil for a second `int` call, so just fix the "int64" mislabel. |
| ExecTimeline ① caption: "int and Cents collapse onto one machine-code body … a single shared stencil" | **CORRECT** | Same source — `int` and `type Cents int` share an underlying type → same gcshape. | None (this specific pairing is right; only the "int64" framing around it is wrong). |
| "All pointer types (`*T`, slices, maps, channels, interfaces) share **one** GC shape" (line ~1441, and Scene/Recap) | **IMPRECISE** | Design doc: all *pointer* types share one gcshape (named after `*uint8`). But slices (3 words), maps/chans (1 pointer word), interfaces (2 words) are **not** all the same shape as `*T`; a slice is not "one pointer-sized word." | Tighten: "All single-pointer types (`*T`, `map`, `chan`, `func`) share one shape; multi-word types like slices (3 words) and interfaces (2 words) each have their own pointer-bearing shape." Calling slices/interfaces the *same* shape as `*T` is incorrect. |
| "Go 1.18+ implements generics via GC-shape stenciling with dictionaries" / "released … March 22, 2022" | **CORRECT** | go.dev/blog/intro-generics: "The Go 1.18 release adds support for generics"; "22 March 2022." | None. |
| "C++ … monomorphization … makes binaries large" / Go chose GC-shape stenciling as a middle path (not full monomorphization, not boxing) | **CORRECT** | Design doc confirms shared instantiation per gcshape vs. full per-type stenciling. | None. |
| "**`any`** is a predeclared alias for `interface{}` (introduced in Go 1.18)" | **CORRECT** | go.dev/ref/spec: "the predeclared type `any` is an alias for the empty interface. [Go 1.18]"; intro-generics: "`any` as an alias for the empty interface type." | None. |
| "`comparable` … All basic types (int, string, bool, pointers, arrays of comparable types, structs whose all fields are comparable) satisfy comparable. Interfaces and slices do not." | **IMPRECISE** | go.dev/ref/spec: `comparable` = "all non-interface types that are strictly comparable." Interfaces "do not *implement* comparable" but "they *satisfy* comparable" as a constraint. Saying flatly "interfaces … do not [satisfy]" is the subtle spec inversion. | Acceptable as an intro simplification, but to be precise: interfaces are not *strictly* comparable so they don't *implement* comparable (slices/maps/funcs never satisfy it at all). Consider hedging the "interfaces … do not" clause. |
| "~int matches `int` itself and also any named type defined as `type Cents int`" (Define ~) and "~string means the set of all types whose underlying type is string" | **CORRECT** | intro-generics: "`~string` means the set of all types whose underlying type is `string`. This includes the type `string` itself as well as all types declared … `type MyString string`." | None. |
| Type inference: "Inference fails [for Zero[T]() T] — there are no arguments to unify against" / return-only params need explicit args | **CORRECT** | intro-generics: "Function argument type inference only works for type parameters that are used in the function parameters, not for type parameters used only in function results … does not apply to functions like `MakeT[T any]() T`." | None. |
| "Generic types must always be fully instantiated — no inference for type declarations" (`var s Stack[int]`) | **CORRECT** | intro-generics / spec: type inference applies to function calls, not type instantiations. | None (note: Go 1.21+ *partial* inference exists for functions but not for type literals, so this is fine). |
| Union-constraint "cannot also list methods" and "cannot write `var x interface{ int | string }` as a variable type" (Gotcha) | **CORRECT** | go.dev/ref/spec: non-basic interfaces "may only be used as type constraints … cannot be the types of values or variables"; union "cannot contain … interfaces that specify methods." | None. |
| **Self-referential constraint `type Adder[A Adder[A]]` "new in Go 1.26"** / "Before Go 1.26 … was a compile error … Go 1.26 lifts this restriction, allowing F-bounded quantification" | **CORRECT** | go.dev/doc/go1.26: "The restriction that a generic type may not refer to itself in its type parameter list has been lifted … `type Adder[A Adder[A]] interface { Add(A) A }` … Previously, the self-reference to `Adder` … was not allowed." Release Feb 2026. | None. The chapter's flagship "Go 1.26" claim is accurate, including the example matching the release notes verbatim. |
| "`constraints` package … as of Go 1.26 … lives in `golang.org/x/exp/constraints`, *not* `slices` or `cmp`" | **CORRECT** | Package still in x/exp; never promoted to stdlib. | None. |
| Section heading "cmp — three-way comparison and the `Ordered` constraint (Go 1.21)" listing **`cmp.Or`** in the same Go-1.21 bullet group | **OUTDATED / WRONG version** | pkg.go.dev/cmp: `Or` is annotated **"added in go1.22.0"**; only `Ordered`/`Compare`/`Less` date from 1.21. | Pin `cmp.Or` to Go 1.22 (e.g. "`cmp.Or` (Go 1.22)") so it isn't bundled under the 1.21 header. |
| `cmp.Ordered` and `cmp.Compare` are "Go 1.21" | **CORRECT** | go.dev/doc/go1.21: "The new `cmp` package defines the type constraint `Ordered` and two new generic functions `Less` and `Compare`." | None. |
| `slices`, `maps`, `cmp` packages "Go 1.21" | **CORRECT** | go.dev/doc/go1.21 release notes confirm all three added in 1.21. | None. |
| Prose signature: "**`maps.Keys[M ~map[K]V, K comparable, V any](m M) []K`** — returns all keys as a slice" (and Values → `[]V`) | **WRONG** | pkg.go.dev/maps: stdlib `Keys` returns **`iter.Seq[K]`** (added go1.23.0), not `[]K`. The `[]K`-returning form is the old `golang.org/x/exp/maps`. The chapter's *own* runnable example (line 1717) correctly uses `slices.Sorted(maps.Keys(...))`, contradicting this prose. | Fix signatures to `maps.Keys(m M) iter.Seq[K]` / `maps.Values(m M) iter.Seq[V]`, and amend "returns all keys as a slice" → "returns an iterator over the keys (collect with `slices.Sorted`/`slices.Collect`)." |
| `maps.Clone[M ~map[K]V, ...](m M) M` — shallow copy | **CORRECT** | pkg.go.dev/maps confirms signature and shallow-copy semantics. | None. |
| "`slices.Collect` and `slices.Sorted` (added in Go 1.23 …)" Callout | **CORRECT** | pkg.go.dev/slices: both "added in go1.23.0." | None. |
| Cost: "Every call through a dictionary has one additional pointer indirection compared to a fully-specialized (monomorphized) call" | **CORRECT (reasonable)** | Design doc confirms dictionary passed as implicit first arg and used for type-specific ops; the per-call indirection characterization is sound. Doc does not quantify it (chapter wisely hedges "measurable in microbenchmarks"). | None. |
| "As of Go 1.21+, the compiler *can* specialize (skip the dictionary) when the instantiation is visible … not guaranteed and not documented as a stable behavior" | **CORRECT (well-hedged)** | Matches the design doc's note that pure-stenciling/specialization is an optimization, not a guarantee; chapter explicitly flags it as non-guaranteed. | None. |
| "`Stack[int]` has `[]int` internally — no interface, no heap allocation per element, no indirection … no boxing for concrete scalar types" | **CORRECT** | Consistent with GC-shape stenciling (value storage, not boxing); only `Stack[anInterfaceType]` boxes, which the chapter correctly notes. | None. |
| "Generic methods accepted ~Go 1.27" (named in audit brief) | **NOT PRESENT** in chapter | grep of file: no "1.27" / "generic method" mention. The chapter never makes this claim, so nothing to verdict. (For the record: proposal golang/go#77273 is Proposal-Accepted, possibly targeting 1.27, not shipped — so the chapter is correct to *omit* it.) | None — no action; brief's premise about this claim does not match the file. |

## CORRECT count

**14 claims CORRECT** (any-alias, ~-operator, type-set, inference rules, generic-type instantiation, union-as-constraint gotcha, self-referential Go 1.26 + example, x/exp/constraints location, cmp.Ordered/Compare 1.21, slices/maps/cmp 1.21, maps.Clone, slices.Collect/Sorted 1.23, dictionary-indirection cost, opportunistic-specialization hedge, no-boxing-for-scalars, monomorphization contrast). Plus 1 NOT-PRESENT (generic-methods 1.27, correctly omitted).

**Defects: 5 WRONG, 2 OUTDATED/version, 2 IMPRECISE.**

## Sources fetched

- https://go.dev/blog/intro-generics
- https://go.googlesource.com/proposal/+/refs/heads/master/design/generics-implementation-dictionaries-go1.18.md
- https://go.dev/doc/go1.26
- https://go.dev/doc/go1.21
- https://go.dev/ref/spec
- https://pkg.go.dev/cmp
- https://pkg.go.dev/maps
- https://pkg.go.dev/slices
- (WebSearch) generic-methods proposal status — golang/go#77273 Proposal-Accepted, possible Go 1.27

## Tally

14 CORRECT · 5 WRONG · 2 OUTDATED(version) · 2 IMPRECISE · 0 UNVERIFIABLE · 1 not-present. Worst defect: the gcshape grouping rule is "same underlying type," not "same size" — so `int`/`int64` sharing a stencil (the chapter's headline example) is false.
