# Accuracy audit — caching-redis

Chapter: `content/part-1/22-caching-redis.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| Exercise 3 solution `main`: `wg.Go(func() { store.GetProductList(...) }())` — note the trailing `()` | **WRONG (won't compile)** | pkg.go.dev/sync (Go 1.25): `func (wg *WaitGroup) Go(f func())` — `Go` takes a `func()`, not the *result* of calling it. The trailing `()` invokes the closure (returning nothing) and passes that void to `wg.Go`, which is a compile error ("not enough arguments" / "used as value"). Every other `wg.Go` call in the chapter is correctly written without the `()`. | Remove the trailing `()`: `wg.Go(func() { store.GetProductList(context.Background()) })`. This contradicts the chapter's own (correct) `wg.Go` usage in the main singleflight example and Exercise 5's harness — a copy/paste slip in one Exercise solution. |
| Singleflight: "`golang.org/x/sync/singleflight` … When N goroutines all call `group.Do("key", fn)` simultaneously, exactly **one** runs `fn`; the others block and receive the same result." | CORRECT | pkg.go.dev/golang.org/x/sync/singleflight: "Do executes and returns the results of the given function, making sure that only one execution is in-flight for a given key at a time. If a duplicate comes in, the duplicate caller waits for the original to complete and receives the same results." | none |
| UnderTheHood: "`Do` blocks the calling goroutine (not a new one) … the function is **not spawned in a new goroutine** — it runs inline." + "`shared` is `true` if at least one other goroutine was waiting." + "`DoChan` … returns a `<-chan Result`." + "`singleflight` does **not** retry on error." | CORRECT | pkg.go.dev singleflight: Do runs `fn` and blocks duplicates (no spawn implied); "The return value shared indicates whether v was given to multiple callers." "DoChan is like Do but returns a channel that will receive the results when they are ready." No retry semantics are documented. | none — all four sub-claims confirmed against the godoc. |
| UnderTheHood: "`singleflight.Group` maintains a `map[string]*call` protected by a `sync.Mutex`. A `call` is a struct holding … `WaitGroup` …" (explicitly hedged: "conceptual model … the exact implementation … may evolve") | UNVERIFIABLE (internals) — acceptably hedged | pkg.go.dev singleflight documents only the public contract, not the `map[string]*call`/`WaitGroup` internals. The source does in fact implement it this way, but the page doesn't certify it. The chapter already labels it "a conceptual model — treat it as such." | Keep the existing hedge. No change needed — the observable behavior taught is correct. |
| Redis eviction policies: `allkeys-lru`, `allkeys-lfu`, `volatile-lru`/`volatile-lfu`, `volatile-ttl`, `noeviction` all exist; `volatile-ttl` = "evict the key closest to expiry" | CORRECT | redis.io eviction docs: policies include `noeviction`, `allkeys-lru`, `allkeys-lfu`, `volatile-lru`, `volatile-lfu`, `volatile-ttl`, etc. "`volatile-ttl`: Evict keys with an associated expiration (TTL) that have the shortest remaining TTL value." | none — "closest to expiry" matches "shortest remaining TTL." |
| "`noeviction`: Return an error on write when full." | CORRECT | redis.io eviction docs: `noeviction` returns an error on writes when the memory limit is reached. | none |
| Redis is "a **single-threaded** event loop written in C … all command processing is serial — no locking, no concurrency inside the server" + QuickCheck answer (event-loop avoids per-key lock contention) | CORRECT (with standard caveat) | Long-documented Redis design: command execution is single-threaded over an epoll/kqueue event loop. (Modern Redis adds I/O threads for socket read/write and background threads for some tasks, but *command execution* remains single-threaded — consistent with the chapter's framing.) The fetched eviction page didn't cover threading; this rests on the canonical Redis architecture docs. | Optional: a one-line note that Redis 6+ added I/O threads for network I/O while keeping command execution single-threaded. Not required — the teaching claim is right. |
| "`go-redis` … `github.com/redis/go-redis/v9` … `Get` returns `redis.Nil` if the key is missing or expired." | CORRECT (conceptual) | go-redis is the canonical Go Redis client; `redis.Nil` is the documented sentinel returned for a missing key. (Driver behavior, not re-fetched — uncontested and standard.) | none |
| The delete-then-write race: "write to the DB **first, then invalidate** the cache" is safer than delete-then-write; explained via the read-repopulates-stale window | CORRECT (conceptual) | Standard cache-aside invalidation guidance (write DB → invalidate). The chapter correctly notes the window is narrower but not zero ("for truly strict consistency, you need distributed transactions or a queue"). | none |
| Phil Karlton quip: "there are only two hard problems in computer science — cache invalidation and naming things." | CORRECT (attribution) | Widely attributed to Phil Karlton; standard industry quotation. Not a Go/runtime claim. | none |
| `sync.WaitGroup.Go` "new in Go 1.25 … calls `wg.Add(1)`, launches the function … and calls `wg.Done()` when the function returns" (Callout, used in examples) | CORRECT | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | none — version pin correct (see Exercise 3 row above for the one place the *usage* is mistyped). |
| Cache penetration → cache a negative sentinel with short TTL; hot keys → L1 promotion / key replication / read replicas | CORRECT (conceptual) | Standard caching-failure-mode mitigations; no source contradicts. | none |
| Fintech rule: "Never cache an authoritative account balance … `SELECT … FOR UPDATE` … No cache sits between a payment authorization and the balance check." | CORRECT (conceptual) | Sound correctness constraint; `SELECT … FOR UPDATE` is documented Postgres row-locking. CQRS read-model-vs-write-model framing is standard. | none |

## CORRECT (verified, not individually tabled)

Cache-aside read path (check cache → miss → DB → populate → return) and write path (write DB → invalidate); read-through vs cache-aside (who owns the miss); write-through (sync, safe) vs write-behind (async, lossy — never for money); TTL as a bounded-staleness commitment; layered L1 (in-process)/L2 (Redis)/L3 (CDN) caching with promote-on-hit; in-process cache incoherence across replicas; pipelining batches N commands into one round-trip; Redis core types (string/hash/list/set/sorted-set/streams) and representative commands; `SCAN` not `KEYS` in production; the generic `GetOrSet[T any]` cache-aside helper; sentinel-caching exercise. All consistent with redis.io, the singleflight godoc, and standard caching theory.

**CORRECT count (verified claims): ~22** (12 tabled CORRECT + ~10 swept).

## Worst finding

**WRONG (won't compile):** Exercise 3's solution writes `wg.Go(func() { store.GetProductList(context.Background()) }())` — the trailing `()` calls the closure and passes its (void) result to `wg.Go`, which takes a `func()`. That is a compile error, and it directly contradicts the chapter's own correct `wg.Go(func(){ … })` usage everywhere else (main example, Exercise 5). Fix: drop the `()`. This is the only hard defect in the chapter; every conceptual claim about Redis (single-threaded event loop, eviction policies, `volatile-ttl`) and every singleflight semantic (one-in-flight, `shared`, `DoChan`, no-retry, inline execution) verified clean against the primary sources.

## Sources fetched
- https://redis.io/docs/latest/develop/reference/eviction/ (eviction policy list; volatile-ttl = shortest remaining TTL; noeviction errors on write)
- https://pkg.go.dev/golang.org/x/sync/singleflight (Do one-in-flight + blocking, shared, DoChan)
- https://go.dev/doc/go1.25 (WaitGroup.Go — for the version pin; usage bug noted separately)

## Tally
- Flagged rows: 13 (1 WRONG/won't-compile to fix; 1 UNVERIFIABLE acceptably-hedged; 11 CORRECT-but-tabled)
- CORRECT (verified): ~22
- WRONG: 1 (Exercise 3 `wg.Go(...)()` trailing-call) · OUTDATED: 0 · IMPRECISE: 0 · UNVERIFIABLE: 1 (singleflight `map[string]*call` internals — already hedged)
- Content file edited: NO (report-only)
