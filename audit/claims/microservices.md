# Accuracy audit — microservices

Chapter: `content/part-1/24-microservices.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| UnderTheHood code: "`Go 1.26: errors.AsType[T] (new in 1.26)` … `if urlErr := errors.AsType[*url.Error](err); urlErr != nil && urlErr.Timeout() { … }`" | **WRONG (won't compile / wrong call shape)** | pkg.go.dev/errors@master: `func AsType[E error](err error) (E, bool)` — "returns that error value **and true**. Otherwise … the zero value of E and false." `AsType` returns **two** values; assigning the single-value result to `urlErr :=` is a compile error ("assignment mismatch: 1 variable but errors.AsType returns 2 values"). | Use the two-value form: `if urlErr, ok := errors.AsType[*url.Error](err); ok && urlErr.Timeout() { … }`. (The sibling chapter `14-software-design-architecture.mdx` already uses the correct two-value shape — make this consistent.) The Go-1.26 *version* attribution is correct; only the call shape is wrong. |
| Recap: "`errors.AsType[T]` (new in Go 1.26) makes distinguishing timeout errors from 'not found' errors cleaner." | CORRECT (version) | go.dev/doc/go1.26: "The new `AsType` function is a generic version of `As`. It is type-safe, faster, and, in most cases, easier to use." | none for the version claim — but the code sample above that this prose refers to is mis-shaped (see prior row). |
| "In **1967**, Mel Conway observed that organizations build systems that mirror their communication structures." | CORRECT | en.wikipedia.org/wiki/Conway's_law: "named after the computer scientist and programmer Melvin Conway, who introduced the idea in **1967**." (Formally published April 1968 in *Datamation*, "How Do Committees Invent?") | none — "1967" matches the introduction date; first name "Mel(vin)" correct. |
| Availability math: "four services at 99.9% each = **99.6%** for the chain." | CORRECT | 0.999^4 = 0.99600599… ≈ 99.6%. | none — arithmetic confirmed. |
| JourneyAnim: "Latencies ADD: 20ms + 30ms + 25ms + 15ms" for a synchronous call chain | CORRECT (conceptual) | Sequential synchronous hops sum their latencies (the user's floor is the sum); illustrative numbers, not asserted as measured. | none |
| Distributed tracing: "**OpenTelemetry** … emit **spans** … linked by a **trace ID** propagated in request headers (`traceparent`)." | CORRECT | W3C Trace Context recommendation defines the `traceparent` HTTP header carrying the trace-id/parent-id; OpenTelemetry propagates it. Standard, uncontested. | none — header name and propagation mechanism are right. |
| UnderTheHood: "As of Go 1.26, the runtime's network poller handles async I/O efficiently — a goroutine blocked on a network read doesn't hold an OS thread." (hedged: "simplified model … detailed in Part 2, Chapter 5") | CORRECT (conceptual) | Documented Go runtime netpoller behavior (epoll/kqueue/IOCP parks the goroutine, releases the M). Not new in 1.26 — the "as of Go 1.26" is a baseline-version framing, not a "new in 1.26" claim, so it is not misleading. | Optional: reword "As of Go 1.26" → "Go's runtime network poller" to avoid implying a 1.26-specific change. Low risk. |
| Network-cost figures: "localhost … tens of microseconds … datacenter 0.5–2ms … across availability zones 1–5ms" | CORRECT (illustrative ranges) | Standard order-of-magnitude latency figures, presented as typical ranges not exact constants. | none |
| Partial failure: "a third outcome exists … the response was lost … If it retries, did it double-charge? … **idempotency keys** are mandatory for any mutating operation" + `Idempotency-Key` header dedup | CORRECT (distributed-systems canon) | Standard distributed-systems framing; the chapter correctly frames safe retry as at-least-once + idempotent dedup (effectively-once), not "exactly-once delivery." | none — notably avoids the "exactly-once delivery" landmine. |
| "A **shared database** between services … is a monolith in a trenchcoat. Each service must own its data exclusively." + "you lose ACID transactions that span service boundaries … you need the **saga pattern**." | CORRECT (conceptual) | Standard microservices data-ownership and saga guidance; cross-service ACID is not available without distributed-transaction protocols. | none |
| gRPC: "schema-first with Protocol Buffers, efficient binary wire format, generated clients … built-in deadline propagation." | CORRECT (conceptual) | Accurate gRPC characterization (protobuf IDL, HTTP/2 binary transport, codegen, deadline propagation). | none |
| Service discovery: "DNS-based (`accounts.meridian.svc.cluster.local` in Kubernetes) … registry-based (Consul, etcd) … Kubernetes handles this via its internal DNS." | CORRECT (conceptual) | Standard service-discovery taxonomy; the K8s cluster-DNS FQDN form `<svc>.<ns>.svc.cluster.local` is correct. | none |

## CORRECT (verified, not individually tabled)

Monolith (one binary, function calls, compiler-checked types, trivial rollback) vs microservices (network hop changes failure model/latency/ops); modular monolith as a valid endgame; "split only when ≥2 of {independent scaling, genuine team autonomy, fault isolation, different tech needs, compliance boundary}"; bounded contexts / DDD as the boundary lens; distributed-monolith anti-pattern (shared DB, sync coupling chains, chatty interfaces); sync (HTTP/gRPC, caller blocks) vs async (queue/event, fire-and-forget, eventual consistency); the `AccountsClient` HTTP wrapper using `http.NewRequestWithContext` + explicit `http.Client{Timeout}`; cascade-vs-containment via timeout + fallback + circuit breaker; expand-contract schema migrations and backward-compatible API evolution; reconciliation jobs for eventual consistency. All consistent with distributed-systems canon and Go stdlib semantics; no "exactly-once delivery" landmine present.

**CORRECT count (verified claims): ~24** (11 tabled CORRECT + ~13 swept).

## Worst finding

**WRONG (won't compile):** the UnderTheHood example calls `errors.AsType` with a single-value assignment — `if urlErr := errors.AsType[*url.Error](err); urlErr != nil && …`. The real signature (verified on pkg.go.dev/errors@master) is `func AsType[E error](err error) (E, bool)`, returning **two** values; the snippet is an assignment-mismatch compile error and teaches the wrong call shape for a brand-new Go 1.26 API. Worse, the *same chapter family* (chapter 14) uses the correct two-value form, so a reader gets contradictory examples. Fix: `if urlErr, ok := errors.AsType[*url.Error](err); ok && urlErr.Timeout() { … }`. Everything else in the chapter is conceptual distributed-systems material that checks out — Conway's Law (1967/Melvin Conway), the 0.999^4 ≈ 99.6% availability math, and the `traceparent`/OpenTelemetry propagation are all correct.

## Sources fetched
- https://pkg.go.dev/errors@master (AsType signature `func AsType[E error](err error) (E, bool)` — two return values)
- https://go.dev/doc/go1.26 (errors.AsType is the new generic version of As)
- https://en.wikipedia.org/wiki/Conway%27s_law (Melvin Conway, idea introduced 1967, published 1968)

## Tally
- Flagged rows: 12 (1 WRONG/won't-compile to fix; 11 CORRECT-but-tabled)
- CORRECT (verified): ~24
- WRONG: 1 (`errors.AsType` single-value call shape) · OUTDATED: 0 · IMPRECISE: 0 (1 optional reword: netpoller "as of Go 1.26") · UNVERIFIABLE: 0
- Content file edited: NO (report-only)
