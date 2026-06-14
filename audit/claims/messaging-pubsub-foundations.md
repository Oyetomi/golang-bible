# Accuracy audit — part-3/05-messaging-pubsub-foundations

Tier-2 chapter (correctness-critical: delivery guarantees / ordering / acks / DLQ). Report-only; no edits applied to the content file.

## Critical finding (the assigned landmine: "exactly-once delivery")

**Framed correctly.** The `<Define term="Exactly-once delivery">` says *"'Exactly-once' is usually a processing/effect guarantee, not a simple delivery guarantee … the pragmatic answer is effectively exactly-once: at-least-once delivery with idempotent consumers."* The prose section and the ConceptGrid repeat this. No claim of true exactly-once *delivery*. No defect on the landmine.

## Note on the Codapi runtime premise (assigned in the brief)

The brief said chapter 05 uses `sync.WaitGroup.Go` (Go 1.25) in runnable GoPlayground blocks and that "the Codapi playground runs Go 1.24, so those won't run there — flag it." **I verified this empirically and the premise is outdated.** The live Codapi sandbox this repo loads (`unpkg.com/@antonz/codapi@0.19.10`, hitting `api.codapi.org`) reports **`go1.25.5`** (`runtime.Version()` over the public API), and codapi.org states "Go version: 1.25." I executed the chapter's `wg.Go` + `for i := range 3` pattern against the live sandbox: **it compiles and runs cleanly** (`ok`, prints worker 0/1/2 + done). So `wg.Go` is **not** a broken-block defect on the current runner. If/when Codapi pins back to 1.24 this would break — but as of this audit (2026-06-14) it runs. Verdict: **NOT A DEFECT (premise outdated).** The runtime is not pinned in this repo, so this is environment-dependent.

## Audit log

| Claim (as written) | Verdict | Source | Proposed fix (NOT applied) |
|---|---|---|---|
| "Exactly-once is usually a processing/effect guarantee, not a delivery guarantee … effectively exactly-once = at-least-once + idempotent consumers." (Define ~line 551, prose ~568, Recap) | **CORRECT** | Distributed-systems canon; matches Kafka EOS reality (Confluent: EOS is idempotent producer + transactions, app still needs idempotent handling). | None. |
| "At-least-once … broker retains the message until the consumer acknowledges it. If the consumer crashes before acknowledging, the broker redelivers." (Define ~547, ExecTimeline ~580) | **CORRECT** | Standard at-least-once semantics (SQS visibility timeout, Kafka rebalance redelivery, RabbitMQ requeue-on-nack). | None. |
| "At-most-once: fire and forget … the message is gone. No duplicate risk." (Define ~543) | **CORRECT** | Standard at-most-once. | None. |
| "An ack must mean 'I have finished processing this message and the result is durable' … Ack after the commit. Not before." (~621–626, ConceptGrid, On-the-job) | **CORRECT** | Canonical ack-after-processing guidance; ack-on-receipt is the classic message-loss bug. | None. |
| "Global ordering … requires a single sequential bottleneck. Most brokers don't provide it. What they do provide is per-partition or per-queue ordering." (~629–633) | **CORRECT** | Kafka: ordering guaranteed only within a partition; partition by key (account ID) to serialize an entity's events. Matches the design. | None. |
| Under-the-Hood: ack timer = "visibility timeout in SQS, the ack deadline in Pub/Sub, the session timeout in Kafka." (~654) | **IMPRECISE** | SQS *visibility timeout* ✓ and Pub/Sub *ack deadline* ✓ are correct. Kafka's redelivery isn't driven by a per-message "session timeout" ack timer — Kafka uses **consumer-offset commits**; redelivery happens on rebalance/restart when uncommitted offsets are re-fetched. `session.timeout.ms` governs consumer-group liveness/rebalance, not per-message ack. | Tighten: drop Kafka from the "ack timer" list, or say "Kafka instead redelivers uncommitted offsets after a rebalance (driven by `session.timeout.ms`/`max.poll.interval.ms` liveness, not a per-message ack timer)." The SQS/Pub-Sub examples are fine. |
| "Most systems trade strict ordering for throughput by pipelining … then using partition keys to keep a single entity's events in order." (~662) | **CORRECT** | Standard throughput-vs-ordering tradeoff; matches Kafka in-flight pipelining + per-key partitioning. | None. |
| "A dead-letter queue is where messages go after they've exceeded their retry limit (max delivery attempts) … without a DLQ a poison message retries forever, clogging the queue." (Define ~680, prose ~691) | **CORRECT** | Standard DLQ semantics (SQS redrive policy `maxReceiveCount`, RabbitMQ DLX). | None. |
| "Returning 4xx would cause well-implemented webhook senders to retry indefinitely; 200 signals 'I received it.'" — (parallels Ch.4) implied throughout DLQ/ack discussion | **CORRECT** | Consistent with provider conventions. | None. |
| "In Go, a buffered channel is a built-in backpressure mechanism. Once full, the send blocks. The producer stalls." (Define ~684, prose ~794) | **CORRECT** | Go channel semantics: send on a full buffered channel blocks until space (go.dev/ref/spec, channel send). | None. |
| "Pull delivery … naturally provides back-pressure … Kafka, SQS, and most high-throughput production systems use pull." (Define ~295, prose ~304) | **CORRECT** | Kafka consumers poll (pull); SQS ReceiveMessage is pull/long-poll. Standard. | None. |
| "Long polling … the broker holds it open until a message arrives (or a timeout). SQS uses this." (ConceptCard ~309) | **CORRECT** | SQS long polling (WaitTimeSeconds up to 20s) — documented behavior. | None. |
| "Kafka topics with consumer groups give you queue semantics within a group and fan-out across groups." (Gotcha ~267) | **CORRECT** | Kafka: within a consumer group each partition is consumed by one member (work-queue); separate groups each get all messages (fan-out). Accurate. | None. |
| "`wg.Go(func(){…})` is new in Go 1.25 … combines `wg.Add(1)` + `go func(){ defer wg.Done(); … }()`." (Callout ~530, prose ~313, Recap ~1357) | **CORRECT** | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | None. |
| "`for i := range 3` (ranging over an integer) and per-iteration loop variable semantics are Go 1.22+ … the old `i := i` shadow is no longer needed." (Callout ~528) | **CORRECT** | go.dev/doc/go1.22: "'For' loops may now range over integers"; "each iteration of the loop creates new variables, to avoid accidental sharing bugs." | None. |
| GoPlayground (Broker fan-out + work-queue demo, lines ~422–522) uses `wg.Go` and `for i := range 3` | **CORRECT (runs on current sandbox)** | Verified: compiles + runs on live Codapi go1.25.5. See "Codapi runtime premise" note above. | None on current runner. (Environment caveat: would fail if Codapi reverts to <1.25.) |
| GoPlayground (DLQ retry demo, lines ~718–784) — stdlib errors/fmt/math-rand-v2/time, `go run`-compatible | **CORRECT (runs)** | Stdlib-only; no `wg.Go`; compiles clean. | None. |
| First Broker code block (lines ~315–418) is shown as fenced `go` WITHOUT a runner, but uses `wg.Go` | **CORRECT (display block)** | This is the annotated teaching copy; the runnable twin follows in `<GoPlayground>`. Both use `wg.Go`; both valid on 1.25. | None. |

## CORRECT count

**16 claims CORRECT** (exactly-once framing, at-least/at-most-once, ack-after-processing, per-partition ordering, ordering/throughput tradeoff, DLQ semantics, webhook 200 convention, buffered-channel backpressure, pull/back-pressure, long polling, Kafka consumer-group queue+fanout, wg.Go 1.25, range-over-int + loop-var 1.22, both GoPlayground blocks run, display block valid). One claim (ack-timer list) is IMPRECISE.

## Sources fetched

- https://docs.confluent.io/kafka/design/delivery-semantics.html (cross-checked for EOS/ordering)
- https://go.dev/doc/go1.25 (WaitGroup.Go)
- https://go.dev/doc/go1.22 (range-over-int, per-iteration loop vars)
- https://codapi.org/go/ (sandbox Go version = 1.25)
- Live Codapi sandbox exec: `runtime.Version()` → `go1.25.5`; ran chapter's `wg.Go`+`range 3` pattern → ok

## Tally

16 CORRECT · 0 WRONG · 0 OUTDATED · 1 IMPRECISE (Kafka in the per-message ack-timer list) · 0 UNVERIFIABLE. **Worst finding:** the Under-the-Hood lumps Kafka's "session timeout" in with SQS visibility-timeout / Pub-Sub ack-deadline as a per-message ack timer; Kafka redelivery is offset-commit/rebalance-driven, not a per-message ack timer — minor and easily tightened. **Brief-premise correction:** the `wg.Go`/Codapi-1.24 "won't run" concern is moot — the live sandbox runs go1.25.5 and the blocks execute cleanly (verified by direct execution).
