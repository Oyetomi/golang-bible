# Accuracy audit — 20-replication

Database-internals / distributed-systems audit of `content/part-2/20-replication.mdx`.
Verified against the DDIA / distributed-systems canon and primary docs (Postgres WAL,
Jepsen/consistency-model references, quorum literature, Go stdlib). REPORT ONLY — no
content file was edited.

Only touched/flagged rows below; every other falsifiable claim in the chapter was
checked and confirmed CORRECT (count at bottom).

| # | Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|---|
| 1 | "Synchronous: the leader waits until at least one follower confirms… Asynchronous: the leader ACKs the client immediately… Most systems run **semi-synchronous**: one follower synchronous, the rest async." | CORRECT | DDIA ch.5 canon; matches the standard sync/async/semi-sync taxonomy. | Leave. |
| 2 | "Postgres exposes this exact knob (`synchronous_commit`, `synchronous_standby_names`)." | CORRECT | postgresql.org/docs/current/runtime-config-wal: "`synchronous_commit`… Valid values are `remote_apply`, `on` (the default), `remote_write`, `local`, and `off`"; works with `synchronous_standby_names`. Set `on`/`remote_apply` + standby names ⇒ leader waits for standby. | Leave. |
| 3 | "the leader confirms to the client NOW — before the followers have the change" (async); "if the leader dies before a follower caught up, those last writes are **gone**" | CORRECT | DDIA canon: async ⇒ unbounded lag + possible loss of acknowledged writes on failover. | Leave. |
| 4 | Failover dangers: (1) async promotion drops the dead leader's last acked writes; (2) zombie old leader ⇒ **split-brain** (two leaders); fix via **fencing** (a token / election term that locks out the old leader). | CORRECT | DDIA "Handling Node Outages / Problems with failover" — names data loss, split-brain, and fencing tokens precisely. | Leave. |
| 5 | "**Replication lag** is the delay between a write applied on the leader and reaching a follower… **Eventual consistency** is the promise that *if writes stop, all replicas eventually converge*… says nothing about *when*." | CORRECT | DDIA: eventual consistency = convergence with no time bound. | Leave. |
| 6 | **Read-your-writes**: "route a user's reads to the leader for a short window after they write." | CORRECT | en.wikipedia.org/wiki/Consistency_model: "A value written by a process… will always be available to a successive read… by the same process." | Leave. |
| 7 | **Monotonic reads**: "pin each user to one replica so they never see older data than they already saw." | CORRECT | jepsen.io/consistency/models/monotonic-reads: "reads cannot go backwards"; Wikipedia: "any successive read… will always return that same value or a more recent value." Pinning to one replica is the canonical fix. | Leave. |
| 8 | **Consistent prefix**: "You see an effect before its cause… Happens when related writes land on followers out of order. Fix: keep causally-related writes in the same partition/order." | CORRECT | DDIA "Consistent Prefix Reads" — same definition and same fix (causally-related writes to same partition). | Leave. |
| 9 | "**W + R > N** guarantees the read and write sets **overlap by at least one**." (+ "pure pigeonhole") | CORRECT | en.wikipedia.org/wiki/Quorum_(distributed_computing): "Vw + Vr > V… ensures that a read quorum contains at least one site with the newest version." Pigeonhole framing is exactly right. | Leave. |
| 10 | "a strict quorum is **not** the same as **linearizability**… edge cases break it (partial writes, reads concurrent with writes, recovery from stale snapshots). Quorums give *probably fresh, usually*… for linearizability you reach for consensus (Raft/Paxos)." | CORRECT | DDIA "Limitations of Quorum Consistency" lists these exact edge cases; Wikipedia consistency-model: quorum/eventual is strictly weaker than linearizability. Unusually well-stated. | Leave. |
| 11 | "QuickCheck N=5, W=3 → smallest R that guarantees overlap is **R=3**" (3+R>5 ⇒ R>2 ⇒ R=3) | CORRECT | Arithmetic over W+R>N (claim #9). | Leave. |
| 12 | **Multi-leader** "typically one leader per data center… offline editing then syncing is multi-leader"; **Leaderless** "Dynamo-style — Cassandra, **DynamoDB**." | IMPRECISE (minor) | DDIA groups Dynamo, Riak, Voldemort, **Cassandra** as leaderless; it explicitly notes **Amazon DynamoDB is NOT the same as Dynamo** and "uses a single-leader replication" internally for its tables despite the shared lineage. Listing DynamoDB under "leaderless" is the common-but-loose grouping (DDIA itself lists "Cassandra, Riak, Voldemort"; DynamoDB is managed and not classic client-coordinated leaderless). | Optional: swap "DynamoDB" → "Riak/Voldemort" or hedge to "the Dynamo-paper lineage (Cassandra, Riak; Amazon's Dynamo)". Defensible as-is; not a hard error. |
| 13 | "**Last-writer-wins** … attaching a **timestamp** to every write and keeping the latest; the others are **discarded** (silently) … fatal for money." | CORRECT | DDIA "Last write wins (discarding concurrent writes)": LWW "achieves… convergence at the cost of durability" and "even discards writes that are not concurrent" — i.e. silent data loss. | Leave. |
| 14 | "**Version vector** … one counter per replica … comparing tells you whether one write *happened before* another or whether they were truly **concurrent**." | CORRECT | DDIA "Version vectors" — counters per replica; compare to distinguish happened-before vs concurrent. (Chapter correctly uses *version vector*, not the narrower per-key "version number".) | Leave. |
| 15 | "design conflicts out: single-leader removes them by construction; append-only/event-sourced turns overwrites into additions; CRDTs (counters/sets) merge in any order." | CORRECT | DDIA "Automatic Conflict Resolution / CRDTs": commutative structures make order irrelevant; event-sourcing/append-only avoids overwrite conflicts. | Leave. |
| 16 | Exercise-2 claim: "`fv > lv` should be impossible under single-leader replication" (followers only replay the leader's ordered log; ahead ⇒ split-brain). | CORRECT | Follows from single-leader's single-ordering authority (DDIA). | Leave. |
| 17 | Code comment: "(Go 1.25's wg.Go combines Add+go+Done into one call)" | CORRECT | pkg.go.dev/sync#WaitGroup.Go: "Added in go1.25.0… Go calls f in a new goroutine and adds that task to the WaitGroup. When f returns, the task is removed." | Leave. |
| 18 | "This is how Postgres, MySQL, and most SQL databases replicate by default" (single-leader). | CORRECT | DDIA: single-leader is the default of "PostgreSQL, MySQL… and others." (Postgres physical/streaming replication is leader→standby.) | Leave. |

## Tally
- Rows examined/flagged here: 18
- WRONG: 0
- OUTDATED: 0
- IMPRECISE: 1 (#12 — "DynamoDB" listed as leaderless; minor, defensible)
- UNVERIFIABLE: 0
- CORRECT (silently confirmed across the chapter, incl. the rows above marked CORRECT): the chapter is technically clean. Roughly 17 distinct load-bearing claims confirmed against sources; ~1 minor imprecision.

**Worst finding:** #12 — classifying **DynamoDB** as "leaderless (Dynamo-style)". DDIA's leaderless examples are Cassandra/Riak/Voldemort, and DDIA explicitly cautions that Amazon DynamoDB ≠ the Dynamo paper and is not client-coordinated-leaderless. This is the common loose grouping, not a true mechanical error — recommend a one-word hedge, not a fix flag. No `{/* ACCURACY */}` flag warranted.

## Sources fetched (this chapter)
- https://www.postgresql.org/docs/current/runtime-config-wal.html
- https://en.wikipedia.org/wiki/Quorum_(distributed_computing)
- https://jepsen.io/consistency/models/monotonic-reads
- https://en.wikipedia.org/wiki/Consistency_model
- https://pkg.go.dev/sync#WaitGroup.Go

Frontmatter unchanged: yes (report-only; no file edited).
