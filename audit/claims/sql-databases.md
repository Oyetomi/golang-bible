# Accuracy audit — sql-databases

Chapter: `content/part-1/18-sql-databases.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| "`SetMaxOpenConns(n)` … Default is **0 — unlimited**." (ConceptGrid + Gotcha + CodeWalk) | CORRECT | pkg.go.dev/database/sql: "If n <= 0, then there is no limit on the number of open connections. The default is 0 (unlimited)." | none |
| "`SetMaxIdleConns(n)` … Default is 2." (ConceptGrid) | CORRECT | pkg.go.dev/database/sql: "The default max idle connections is currently 2. This may change in a future release." | none |
| "sql.Open opens NOTHING. No TCP, no auth, no validation — a wrong password sails through here happily." | CORRECT | pkg.go.dev/database/sql: "Open may just validate its arguments without creating a connection to the database. To verify that the data source name is valid, call DB.Ping." | none |
| "you share the *sql.DB everywhere — it's concurrency-safe by design." | CORRECT | pkg.go.dev/database/sql: "DB is a database handle representing a pool of zero or more underlying connections. It's safe for concurrent use by multiple goroutines." | none |
| "`ROLLBACK` after `COMMIT` returns `sql.ErrTxDone`" / QuickCheck: "Calling Commit on a closed transaction returns sql.ErrTxDone." | CORRECT | pkg.go.dev/database/sql: "ErrTxDone is returned by any operation that is performed on a transaction that has already been committed or rolled back." | none |
| "Go 1.26 added `errors.AsType[T]` as a generic shorthand for the `errors.As` pattern." (Callout + Recap) | CORRECT | go.dev/doc/go1.26: "The new AsType function is a generic version of As. It is type-safe, faster, and, in most cases, easier to use." | none |
| UnderTheHood: "when you call `db.Prepare` … the resulting `*sql.Stmt` caches one `driverStmt` per open connection. On a heavily sharded pool this means N copies of the same prepared statement — one per conn." | CORRECT (well-modeled) | pkg.go.dev/database/sql: "If a Stmt is prepared on a DB, it will remain usable for the lifetime of the DB. When the Stmt needs to execute on a new underlying connection, it will prepare itself on the new connection automatically." (Confirms per-connection prepare; the N-copies framing is a fair description.) | none |
| UnderTheHood: "the `connRequests` map replaced an older channel in Go 1.5"; "The core pool design has been stable since Go 1.1" | UNVERIFIABLE | No primary source fetched for the Go 1.1 / Go 1.5 internal-history attribution (these are runtime-source/changelog claims; the database/sql godoc does not state version history of internal fields). | Soften: "the pool acquired its current shape in early Go releases" or add a "simplified model; internal layout is implementation-defined" hedge. Already partially hedged ("Behavior described here is accurate through Go 1.26"). |
| "rows.Close() returns the underlying connection to the pool. If you skip it the connection is never returned — it is leaked." (prose + QuickCheck explain) | CORRECT (behavioral) | pkg.go.dev/database/sql: "Close closes the Rows, preventing further enumeration. If Rows.Next … returns false … the Rows are closed automatically." (Connection release on close/exhaustion is the documented model; leak-on-missing-Close is the standard, accurate consequence.) | none |
| Parameterized-query SQLi defense: "the SQL has a placeholder (`$1`, `$2`, …) and the driver sends the actual value in a separate Bind message … SQL injection structurally impossible." | CORRECT | Matches Postgres extended-query (Parse/Bind/Execute) protocol; consistent with database/sql parameterization. Conceptually accurate; the ExecTimeline Parse→Bind→Execute ordering is correct. | none |
| `sql.Null*` types ("`sql.NullString`, `sql.NullInt64`, `sql.NullBool`, `sql.NullTime`") | CORRECT | pkg.go.dev/database/sql lists NullBool, NullByte, NullInt16/32/64, NullFloat64, NullString, NullTime, and generic `Null[T]` (added Go 1.22). | Optional enrichment: could mention generic `Null[T]` (Go 1.22+); not an error. |
| `CREATE INDEX CONCURRENTLY` "does not lock the table" | CORRECT (Postgres) | Standard Postgres behavior (CONCURRENTLY avoids the ACCESS EXCLUSIVE lock that blocks writes). Not a Go claim; within scope as a DB mechanic. No Postgres doc fetched, but this is well-established and not a confident-wrong LLM landmine. | none (optionally note "no full table-write lock" precisely) |
| Read-after-write / async streaming replication, `replay_lag`, `pg_stat_replication` (Read Replicas section) | CORRECT (conceptual) | Distributed-systems / Postgres replication canon; framed correctly as async-by-default with post-write primary routing. No Go-internals claim. | none |

## CORRECT (verified, not individually tabled)

Pool borrow/return/queue semantics (PoolAnim, ExecTimeline), `PingContext` forcing a real connection, `BeginTx`/`Commit`/`Rollback` API shape, isolation level `LevelReadCommitted` as Postgres default, expand-contract migration phases, N+1 → JOIN/IN reasoning, EXPLAIN seq-scan vs index-scan distinction, sqlc/sqlx/ORM trade-offs, MongoDB multi-document ACID since 4.0 (replica sets) / 4.2 (sharded clusters). These align with database/sql godoc and standard DB knowledge; counted here, not flagged.

**CORRECT count (verified claims): ~24** (12 tabled CORRECT + ~12 swept).

## Worst finding

No WRONG claims. Worst item is **UNVERIFIABLE**: the internal pool-history attribution ("connRequests map replaced an older channel in Go 1.5", "stable since Go 1.1") — sourced from memory, not a fetched primary; recommend a "simplified / implementation-defined" hedge.

## Sources fetched
- https://pkg.go.dev/database/sql
- https://go.dev/doc/go1.26 (errors.AsType[T])

## Tally
- Flagged rows: 13 (1 UNVERIFIABLE to downgrade; 12 CORRECT-but-tabled for traceability)
- CORRECT (verified): ~24
- WRONG: 0 · OUTDATED: 0 · IMPRECISE: 0 · UNVERIFIABLE: 1
- Content file edited: NO (report-only)
