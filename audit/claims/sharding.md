# Accuracy audit — 21-sharding

Database-internals audit of `content/part-2/21-sharding.mdx`. Verified against the
DDIA partitioning canon and primary docs (Cassandra/ScyllaDB ring docs, HBase config
reference, Riak cluster docs, DynamoDB docs, consistent/rendezvous-hashing references,
Go `hash/maphash`). REPORT ONLY — no content file was edited.

Only touched/flagged rows below; all other falsifiable claims were checked and confirmed
CORRECT (count at bottom).

| # | Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|---|
| 1 | "Sharding splits one dataset into shards… each record lives in exactly one shard"; replication copies the whole dataset; production does both (each shard replicated). | CORRECT | DDIA ch.6 "Partitioning"; matches the partition/replication orthogonality exactly. | Leave. |
| 2 | "**Key-range sharding** assigns each shard a sorted contiguous range… makes range scans cheap… invites **hot spots**." | CORRECT | DDIA "Partitioning by Key Range": sorted ranges ⇒ efficient range scans but "certain access patterns can lead to hot spots" (e.g. timestamp key). | Leave. |
| 3 | "The classic hot-shard trap: shard by **timestamp**… every write lands on the 'this month' shard… fix: make the key `(account_id, timestamp)`." | CORRECT | DDIA gives this exact timestamp-key example and the compound-key fix. | Leave. |
| 4 | "Rebalancing key-range: when a shard gets too big, **split its range in two**… **(HBase splits at ~10 GB by default.)**" | CORRECT | hbase-default config: `hbase.hregion.max.filesize` default `10737418240` (= 10 GiB): "If the sum of the sizes of a region's HFiles… exceed this value, the region is split in two." | Leave. |
| 5 | "Bigtable, HBase, CockroachDB, and MongoDB's range mode all shard this way" (key-range). | CORRECT | DDIA names HBase/Bigtable/MongoDB range mode for key-range; CockroachDB uses range-based key partitioning. | Leave. |
| 6 | "**Hash sharding** computes `hash(partition_key)`… kills the hot-shard problem… but **destroys ordering**, so range scans hit every shard." | CORRECT | DDIA "Partitioning by Hash of Key": "we lose the ability to do efficient range queries." | Leave. |
| 7 | "Mapping with `hash(key) % N` (N = node count)… when N changes, almost every key maps to a different node… nearly the whole dataset moves." | CORRECT | DDIA "rebalancing: hash mod N" anti-pattern. Code's `k%3 != k%4` ≈ 75% is arithmetically right. | Leave. |
| 8 | "Create many more shards than nodes… `hash(key) % numberOfShards` where shard count **never changes**… rebalancing reassigns whole shards to nodes… Citus, Riak, Elasticsearch, Couchbase all use it." | CORRECT | DDIA "Fixed number of partitions"; Riak docs: "This ring is divided into partitions, with each Riak vnode responsible for one… (claims that partition)" — partition count fixed, vnodes redistribute across nodes. | Leave. |
| 9 | "**Hash-range sharding** assigns each shard a *range of hash values*… **Cassandra and ScyllaDB** chop the hash space into many small ranges per node **(16 and 256 respectively)** **with random boundaries, so imbalances average out.**" | IMPRECISE / partly WRONG | cassandra.apache.org dynamo doc: random tokens "meant… the default number of tokens per node had to be quite high, at **256**" (2.x); "in 3.x+ a new **deterministic** token allocator… requiring a much lower number of tokens." Cassandra 4.0 production guide: "`num_tokens: 16`". ScyllaDB ringarchitecture: num_tokens "default is `256`". → The **16 / 256** pairing is correct (Cassandra modern = 16, ScyllaDB = 256). But **"with random boundaries, imbalances average out"** is wrong for the Cassandra=16 case: 16 *random* tokens do NOT average out — that's precisely why Cassandra moved to a **deterministic** allocator to drop from 256→16. "Random, averages out" only describes ScyllaDB's 256 (and old Cassandra 2.x's 256). | Split the clause: e.g. "ScyllaDB uses ~256 random-ish tokens so imbalance averages out; modern Cassandra uses ~16 tokens chosen by a *deterministic* allocator instead." Worth a `{/* ACCURACY */}` flag for human pinning of the exact version-specific defaults. |
| 10 | "**Consistent hashing** (the Karger et al. 1997 algorithm, plus **rendezvous and jump hashing**) is a **family** of functions designed so changing the number of shards moves the **minimum** possible keys… nothing to do with replica/ACID consistency." | IMPRECISE | en.wikipedia.org/wiki/Consistent_hashing: term introduced by Karger et al. 1997; "only n/m keys need to be remapped on average." en.wikipedia.org/wiki/Rendezvous_hashing: "Consistent hashing… is a special case of HRW [rendezvous]" — so rendezvous is the *more general* technique, not a member of a "consistent-hashing family." The "minimum keys moved" and "not ACID consistency" parts are correct. | Soften to "consistent hashing and its relatives (rendezvous/HRW, jump hashing) — a family of minimal-movement hashes." Containment is technically inverted but the pedagogical grouping is fine. Low priority. |
| 11 | "**The Go footgun:** do not shard with Go's built-in map hash. As of Go 1.14+ the runtime seeds map hashing with a per-process random value (and `hash/maphash` is explicitly per-process random)… same key hashes differently in different processes. Use `hash/fnv` / `crc32` / `crypto/sha256`." | CORRECT | pkg.go.dev/hash/maphash: "Each Seed value is local to a single process and cannot be serialized or… recreated in a different process"; "A zero Hash chooses a random seed." Map-hash randomization is the well-known runtime behavior. Advice to use fnv/crc32/sha256 is sound. | Leave. |
| 12 | "**Hot key**… a uniform hash can't save you, because all traffic for one key lands on one shard… mitigation: **split the hot key** by appending a small random suffix… reads must now fan out." | CORRECT | DDIA "Skewed Workloads and Relieving Hot Spots": exactly this random-suffix split + the read fan-out tradeoff; only for the few hot keys. | Leave. |
| 13 | "Cloud databases automate this (**DynamoDB's 'adaptive capacity'**, S3's 'heat management')." | CORRECT | AWS DynamoDB docs + adaptive-capacity blog: adaptive capacity "automatically increasing throughput capacity for partitions that receive more traffic," letting apps "continue reading and writing to hot partitions." | Leave. |
| 14 | "Automatic rebalancing + automatic failure detection ⇒ **cascading failure**" (slow node mis-declared dead → rebalance → more load → more false deaths). | CORRECT | DDIA "Operations: Automatic or Manual Rebalancing" warns of exactly this cascade; recommends a human in the loop. | Leave. |
| 15 | "DynamoDB autoscales shards in minutes." | UNVERIFIABLE (timing) | DynamoDB partition splits/adaptive capacity are documented as automatic & background, but AWS publishes no hard "in minutes" SLA. Mechanism is right; the *minutes* number is uncited. | Downgrade phrasing → "autoscales shards automatically (typically within minutes)" or drop the unit. Low priority. |
| 16 | "Most systems use a separate coordination service — **ZooKeeper or etcd** — that holds the authoritative shard map and notifies routers… MongoDB's `mongos`… consensus avoids split-brain." | CORRECT | DDIA "Request Routing": ZooKeeper-style coordination service holds the mapping and notifies routers; mongos is the routing tier; the three routing approaches (any-node / routing tier / shard-aware client) match DDIA's three. | Leave. |
| 17 | "**Local (document-partitioned)** index: cheap writes (one shard), scatter/gather reads — MongoDB, Cassandra, Elasticsearch. **Global (term-partitioned)** index: one-shard reads, fan-out writes, often async/briefly stale — CockroachDB, TiDB, DynamoDB global indexes." | CORRECT | DDIA "Partitioning Secondary Indexes": document-partitioned = scatter/gather reads (MongoDB/Cassandra/ES), term-partitioned = read-one/write-many and "often asynchronous" (DynamoDB GSIs are eventually consistent). | Leave. |

## Tally
- Rows examined/flagged here: 17
- WRONG: 0 outright (1 partly-wrong clause embedded in #9)
- OUTDATED: 0 (the 16-vs-256 numbers are current; the *reasoning* attached to them is the issue)
- IMPRECISE: 2 (#9 "random boundaries… average out" mis-applied to Cassandra-16; #10 rendezvous/jump as "consistent-hashing family" — containment inverted)
- UNVERIFIABLE: 1 (#15 "autoscales… in minutes" — uncited timing)
- CORRECT: ~14 load-bearing claims confirmed against sources. The numeric backbone (HBase 10 GB, Cassandra 16, ScyllaDB 256, ~75% mod-N move, fixed-shard decoupling, maphash per-process random) is all accurate.

**Worst finding:** #9 — "Cassandra and ScyllaDB… (16 and 256 respectively) **with random boundaries, so imbalances average out**." The numbers are right, but pairing Cassandra's modern **16** tokens with "random boundaries that average out" is self-contradictory: 16 random tokens are too few to balance, which is exactly why Cassandra 3.x+ added a **deterministic** token allocator to replace random selection. "Random, averages out" describes only the 256-token regime (ScyllaDB, and legacy Cassandra 2.x). Recommend flagging for a human to split the sentence and pin versions.

## Sources fetched (this chapter)
- https://en.wikipedia.org/wiki/Consistent_hashing
- https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html
- https://cassandra.apache.org/doc/4.0/cassandra/getting_started/production.html
- https://opensource.docs.scylladb.com/stable/architecture/ringarchitecture/index.html
- https://hbase.apache.org/2.3/book.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-uniform-load.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html
- https://aws.amazon.com/blogs/database/how-amazon-dynamodb-adaptive-capacity-accommodates-uneven-data-access-patterns... (adaptive capacity)
- https://en.wikipedia.org/wiki/Rendezvous_hashing
- https://docs.riak.com/riak/kv/latest/learn/concepts/clusters/index.html
- https://pkg.go.dev/hash/maphash

Frontmatter unchanged: yes (report-only; no file edited).
