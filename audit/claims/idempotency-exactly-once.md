# Accuracy audit — part-3/04-idempotency-exactly-once

Tier-2 chapter (correctness-critical: idempotency / exactly-once / outbox). Report-only; no edits applied to the content file.

## Critical finding (the assigned landmine: "exactly-once delivery")

**The chapter frames exactly-once correctly.** Every place it touches delivery guarantees it explicitly says true exactly-once *delivery* is impossible and that what you build is **at-least-once delivery + idempotent processing = effectively-once**. The `<Define>` for "Exactly-once delivery" reads: *"Theoretically impossible in an asynchronous distributed system (see the Two Generals Problem and FLP impossibility). What brokers call 'exactly-once' is always at-least-once + a dedup layer."* The Kafka EOS Under-the-Hood is also honest: *"What Kafka's EOS does not give you is exactly-once processing in your application."* No defect on the landmine. The one nit below is on the FLP citation, not the framing.

## Audit log

| Claim (as written) | Verdict | Source | Proposed fix (NOT applied) |
|---|---|---|---|
| "Exactly-once delivery … Theoretically impossible in an asynchronous distributed system (see the Two Generals Problem and FLP impossibility)." (Define + prose ~line 511, 524) | **CORRECT (framing); IMPRECISE (FLP scope)** | Two Generals (RFC/Wikipedia): "no way to guarantee … each general is sure the other has agreed"; "first … proven to be unsolvable." FLP (Wikipedia/Consensus): impossibility is about **deterministic consensus** in a fully asynchronous system with ≥1 crash — *"FLP does not state that consensus can never be reached: merely that … no algorithm can always reach consensus in bounded time."* | Two Generals is the apt citation (it's the ack/agreement-over-lossy-channel result). FLP is about *consensus*, not delivery; it's a defensible analogy but slightly loose. Optional: soften to "the Two Generals problem (and, by analogy, FLP's consensus impossibility)." |
| "At-least-once delivery + idempotent processing = effectively-once / effectively-exactly-once." (JourneyAnim caption, Defines, Recap) | **CORRECT** | Two Generals + standard distributed-systems canon; matches the idempotent-consumer pattern. | None. |
| "HTTP `GET` is idempotent by spec. `DELETE` is idempotent by spec. `POST` is not." (~line 148) | **CORRECT** | RFC 9110 §9.2.2: idempotent methods are "GET, HEAD, PUT, DELETE, and OPTIONS"; "POST is explicitly NOT idempotent"; GET is also "safe." | None. |
| "a function `f` is idempotent when `f(f(x)) = f(x)`." (~line 148) | **CORRECT** | Standard definition; matches "multiple identical requests … same effect as a single request" (RFC 9110). | None. The `f(f(x))=f(x)` form is the math-function idempotence and is fine here. |
| "`INSERT … ON CONFLICT (key) DO NOTHING` … compiles to a single PostgreSQL atomic operation backed by the unique index … cannot see a race between two inserts … no gap … unlike a naive SELECT-then-INSERT (TOCTOU)." (~line 222, 362, 501) | **CORRECT** | PostgreSQL `INSERT … ON CONFLICT` (UPSERT) semantics: conflict resolution is atomic against the unique index; documented to avoid the read-then-write race. Sound as written. | None. |
| "`RowsAffected()` … 1 = we won; 0 = key already existed" (ClaimKey / IsAlreadyProcessed) | **CORRECT** | `ON CONFLICT DO NOTHING` reports 0 rows affected on conflict, 1 on insert (database/sql `Result.RowsAffected`). | None. |
| "`FOR UPDATE SKIP LOCKED` … As of PostgreSQL 9.5 … this clause is supported." (~line 878) | **CORRECT** | `SKIP LOCKED` was added in PostgreSQL **9.5** (row-locking clause); standard outbox-relay pattern. | None. |
| "Kafka's 'exactly-once semantics' (EOS, added in Kafka 0.11)" — idempotent producer uses ProducerID + per-partition SequenceNumber; transactions span topics/partitions; consumers with `isolation.level=read_committed` see only committed offsets. (~line 549–553) | **CORRECT** | Confluent delivery-semantics: idempotent producer + transactional delivery "Since version 0.11.0.0"; "broker assigns each producer an ID and deduplicates … using a sequence number"; transactions write offsets "in the same transaction"; "In read_committed, the consumer only reads messages from committed transactions." | None — all four sub-claims verified verbatim. |
| "Kafka's idempotent producer … prevents duplicates from producer retries — but only within a single producer session." | **CORRECT** | Matches PID/epoch design — dedup state is per producer session/epoch, not across restarts without transactions. | None. |
| "Money is never a float … Use integer minor units (cents, pence, satoshis) or a decimal library like `shopspring/decimal`." (~line 144) | **CORRECT** | Audit landmine: money must be integer minor units or a decimal type, never float64. Chapter complies throughout (all amounts `int64` cents). | None. |
| "`errors.AsType[T]` provides a generic helper for unwrapping typed errors" (as of Go 1.26) (~line 702, Recap) | **CORRECT** | go.dev/doc/go1.26: "The new `AsType` function is a generic version of `As`. It is type-safe, faster …" | None. |
| "`BeginTx` … (as of Go 1.26 with `database/sql`'s `BeginTx`)" and `CompleteKey` runs in the same transaction as the business change | **CORRECT** | database/sql `BeginTx` is long-standing (Go 1.8+); pinning to 1.26 baseline is harmless. The same-transaction atomicity claim is the correct design. | None (version pin is over-cautious but not wrong). |
| "`sql.LevelSerializable`" used for the transfer transaction | **CORRECT** | database/sql isolation level constant; valid. | None. |
| Retention: "keys are typically retained for 24 hours to 7 days" / dedup "7 days for most Kafka and SQS configurations." (~line 176, 493) | **CORRECT (reasonable)** | Stripe idempotency keys expire ~24h; SQS max message retention is 14 days (default 4 days); Kafka retention is config-driven. The "7 days for most" is a soft generalization, appropriately hedged with "typically/most." | None — phrasing is already hedged. |
| Exercise 1 solution: retry on 5xx/network, not on 4xx or "200 with status failed"; always reuse the same idempotency key | **CORRECT** | Standard payments retry guidance (transport-layer vs business-logic failures). | None. |
| Exercise 3 note: "returning 4xx would cause well-implemented webhook senders to retry indefinitely. Returning 200 signals 'I received it.'" | **CORRECT** | Matches webhook-provider conventions (Stripe/GitHub: non-2xx triggers retries). | None. |
| GoPlayground blocks (InMemoryIdempotencyStore demo; retryableCharge backoff demo) — stdlib-only, `go run`-compatible | **CORRECT (runs)** | Both use only fmt/sync/atomic/context/time/math-rand-v2; `for attempt := range cfg.MaxAttempts` (range-over-int, Go 1.22+); compile clean on the live Codapi go1.25.5 sandbox. | None. |

## CORRECT count

**15 claims CORRECT** (effectively-once equation, HTTP idempotency per RFC 9110, f(f(x)) definition, ON CONFLICT atomicity + TOCTOU contrast, RowsAffected semantics, SKIP LOCKED since PG 9.5, Kafka EOS 0.11 four-part, per-session dedup scope, money-as-integer-cents, errors.AsType 1.26, BeginTx same-tx, LevelSerializable, retention windows, Exercise 1 retry rules, Exercise 3 200-on-dup, GoPlayground runs). One claim (exactly-once framing) is CORRECT on the headline but IMPRECISE on the FLP citation.

## Sources fetched

- https://www.rfc-editor.org/rfc/rfc9110.html (HTTP method idempotency/safety)
- https://en.wikipedia.org/wiki/Two_Generals%27_Problem
- https://en.wikipedia.org/wiki/Consensus_(computer_science) (FLP)
- https://docs.confluent.io/kafka/design/delivery-semantics.html (Kafka EOS / idempotent producer / transactions / read_committed)
- https://go.dev/doc/go1.26 (errors.AsType)
- https://go.dev/doc/go1.22 (range-over-int)
- Live Codapi sandbox exec (runtime.Version() → go1.25.5; GoPlayground compile check)

## Tally

15 CORRECT · 0 WRONG · 0 OUTDATED · 1 IMPRECISE (FLP citation scope) · 0 UNVERIFIABLE. **Worst finding:** none material — the chapter is technically clean. The only nit: it cites *FLP impossibility* (a consensus result) alongside Two Generals as proof exactly-once delivery is impossible; FLP is about deterministic consensus in async systems, not delivery, so it's a slightly loose analogy. The core "exactly-once delivery is impossible → build at-least-once + idempotent = effectively-once" framing (the assigned landmine) is correct everywhere.
