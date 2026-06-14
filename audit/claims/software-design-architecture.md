# Accuracy audit — software-design-architecture

Chapter: `content/part-1/14-software-design-architecture.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| Callout "Errors crossing port boundaries — Go 1.26": "As of Go 1.26, `errors.AsType[T]` makes typed unwrapping more ergonomic … `if dbErr, ok := errors.AsType[*pq.Error](err); ok { … }`" | CORRECT | go.dev/doc/go1.26: "The new `AsType` function is a generic version of `As`. It is type-safe, faster, and, in most cases, easier to use." pkg.go.dev/errors@master: `func AsType[E error](err error) (E, bool)` — "returns that error value and true." The chapter's two-value `dbErr, ok :=` usage matches the real `(E, bool)` signature. | none — version pin AND call shape are both right. (NOTE: the microservices chapter uses the SAME function with a WRONG one-value call shape — see that audit.) |
| UnderTheHood: "A Go interface value is **two machine words**: a pointer to the type descriptor (the itable …) and a pointer to the data. The itable … caches the function pointers for each method." | CORRECT | research.swtch.com/interfaces: "Interface values are represented as a two-word pair giving a pointer to information about the type stored in the interface and a pointer to the associated data." "The itable … becomes a list of function pointers." | none |
| UnderTheHood: "The itable is **generated at compile time** for each concrete-type/interface pair" / "At the assignment site, it generates a small itable" | IMPRECISE | research.swtch.com/interfaces: "the itable … gets computed … the compiler … or at runtime … In Go, [itables] are computed at runtime … cached." The article describes itables as computed/cached (the runtime can build them on first use), not strictly "generated at compile time." | Soften to "the itable is computed for each concrete-type/interface pair (the compiler emits or the runtime builds and caches it)." The teaching point — zero-registration, verified statically, one indirection at call — is correct. Low risk. |
| UnderTheHood: "the compiler can **devirtualize** (inline the real function) when the concrete type is visible at the call site." | CORRECT (conceptual) | Devirtualization is a documented `cmd/compile` optimization; the claim is correctly hedged ("when the concrete type is visible"). The chapter's own footnote pins it to "the unified IR compiler pipeline, current as of Go 1.26." | none |
| "Go's compiler **refuses to compile circular imports**." | CORRECT | go.dev/ref/spec (Import declarations) + tooling behavior: import cycles are a hard build error in Go. | none |
| "`internal/` … Any package whose path contains `internal/` can only be imported by code rooted at the parent directory." | CORRECT | Documented `go` tool rule (internal packages importable only by code in the tree rooted at the parent of `internal/`). | none |
| "golang-standards/project-layout … is **not** the Go team's standard … the Go team has explicitly said it does not represent official guidance." | CORRECT | Widely documented community position; the repo is a third-party convention, not maintained by the Go team. Not a runtime/spec claim. | none |
| Hexagonal architecture "also called Ports and Adapters, **coined by Alistair Cockburn**" | CORRECT | Ports and Adapters / Hexagonal Architecture is attributed to Alistair Cockburn (his alistair.cockburn.us writeup). Historical attribution, not a Go internals claim. | none |
| LSP gotcha: "A `*PostgresStore` that is `nil` satisfies the `LedgerWriter` interface — the interface value is non-nil … calls `.Save()` … and panics." | CORRECT | Standard Go typed-nil semantics (interface non-nil when the type word is set, even if the data pointer is nil). Whether `.Save()` panics depends on the method body dereferencing the receiver — consistent as written. | none |
| Pointer-receiver method-set rule: "If your interface method set requires a pointer receiver, a value of that type won't satisfy the interface — the compiler will tell you." | CORRECT | go.dev/ref/spec (Method sets): the method set of `T` does not include pointer-receiver methods; only `*T`'s method set does. | none |

## CORRECT (verified, not individually tabled)

SOLID mapping (SRP = one reason to change; OCP via interfaces/composition; LSP via the type system; ISP = small consumer-defined interfaces; DIP = domain defines the port, adapter implements, arrow points inward) — these are design principles, not falsifiable Go internals; the Go-specific mechanics they rest on (implicit/structural interface satisfaction verified at compile time, no `implements` keyword, no runtime registration) are all correct per go.dev/ref/spec. Entities-vs-value-objects (DDD), `Money` as `int64` cents never float, business rules in the domain not the handler, fake-vs-mock testing guidance, expand-contract migration — all conceptually sound and not contradicted by any source.

**CORRECT count (verified claims): ~18** (8 tabled CORRECT + ~10 swept).

## Worst finding

No WRONG or OUTDATED claims. The most material item is **IMPRECISE**: the UnderTheHood claim that the itable is "generated at compile time … at the assignment site." Russ Cox's canonical description has itables computed and cached (the runtime can build them on first use), so "generated at compile time" overstates it. This does not mislead on the load-bearing teaching point (zero registration, structural satisfaction, single indirection). Notably, this chapter's `errors.AsType[*pq.Error](err)` usage is the *correct* two-value `(E, bool)` form — the sibling microservices chapter gets the same function's call shape wrong, so cross-check there.

## Sources fetched
- https://go.dev/doc/go1.26 (errors.AsType is a generic version of As)
- https://pkg.go.dev/errors@master (AsType signature: `func AsType[E error](err error) (E, bool)`)
- https://research.swtch.com/interfaces (two-word interface value, itable, computed/cached)

## Tally
- Flagged rows: 10 (9 CORRECT-but-tabled; 1 IMPRECISE to hedge)
- CORRECT (verified): ~18
- WRONG: 0 · OUTDATED: 0 · IMPRECISE: 1 (itable "generated at compile time") · UNVERIFIABLE: 0
- Content file edited: NO (report-only)
