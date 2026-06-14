# Accuracy audit — 22-storage-engines

Database-internals audit of `content/part-2/22-storage-engines.mdx`. Verified against the
DDIA storage-engine canon and primary docs (RocksDB leveled/universal compaction wikis,
PostgreSQL page-layout docs, Bloom-filter literature, write-amplification reference, Go
stdlib). REPORT ONLY — no content file was edited.

Only touched/flagged rows below; all other falsifiable claims were checked and confirmed
CORRECT (count at bottom).

| # | Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|---|
| 1 | "A **log** here is an append-only sequence of records on disk… appending is the single fastest write a disk can do (no seeking)." | CORRECT | DDIA ch.3 "Hash Indexes": append-only segment file; sequential append is the disk's fastest write. | Leave. |
| 2 | "Index speeds reads and **slows writes**, because every index must be updated on every write — the central tension." | CORRECT | DDIA: "well-chosen indexes speed up reads but… slow down writes." | Leave. |
| 3 | "An **SSTable** is an on-disk file of key-value pairs sorted by key, each key once. A **memtable** is an in-memory sorted structure (balanced tree / skip list)… full memtable flushed to disk as a new immutable SSTable." | CORRECT | DDIA "SSTables and LSM-Trees": exactly this — sorted, one key per file, memtable (red-black/AVL/skiplist) flushed when full. | Leave. |
| 4 | LSM write path: "append to **WAL** first (durability before ack) → insert into memtable (ack here) → flush full memtable as new SSTable; its WAL slice can be discarded." | CORRECT | DDIA: WAL (unsorted append) crash-recovers the memtable; on flush the corresponding log can be discarded. Order (WAL→memtable→flush) is right. | Leave. |
| 5 | "Reads check **newest to oldest** and stop at first hit; deletes are a **tombstone**; each SSTable carries a **Bloom filter**; background **compaction** merges SSTables." | CORRECT | DDIA: newest-segment-first lookup, tombstone deletes, Bloom filters to skip absent keys, merge-compaction. | Leave. |
| 6 | "Compaction is a background mergesort… one key at a time per file… on a tie keep the **newer** value; tombstone removes the key once merged into the oldest level." | CORRECT | DDIA merge description; matches mergesort merge step + tombstone-drops-at-bottom-level semantics. | Leave. |
| 7 | "**Size-tiered** merges smaller SSTables into bigger ones — great for write-heavy (rewritten only a few times). **Leveled** keeps fixed-size SSTables in growing levels (L0,L1,L2…), incremental merge — less disk space, faster reads. write-heavy → size-tiered; read-heavy → leveled." | CORRECT | RocksDB Universal-Compaction wiki: universal (= size-tiered) "targeting… lower write amplification, trading off read… and space amplification." RocksDB Leveled-Compaction wiki: dynamic-level "can guarantee 90% of data in the last level" (low space amp) + per-file binary search (good reads). Direction matches. | Leave. |
| 8 | "**B-tree** divides disk into fixed-size **pages** (typically **4–16 KiB**) and updates them in place… every major relational DB (Postgres, MySQL, SQL Server, Oracle) uses one." | CORRECT | postgresql.org page-layout: pages "of a fixed size (usually 8 kB)" — inside the stated 4–16 KiB range. DDIA: B-tree pages 4 KiB typical; standard in relational DBs. | Leave. |
| 9 | "**Branching factor** (references per page, often several hundred) keeps the tree shallow — three or four levels can address hundreds of terabytes… a lookup reads one page per level (≈3–4 disk reads)." | CORRECT | en.wikipedia.org/wiki/B-tree: high branching factor "reduces the height"; log₁₀₀(1e6)=3 reads example. DDIA: "a four-level tree of 4 KB pages with branching factor 500 can store 256 TB." Order-of-magnitude and 3–4 reads are right. | Leave. |
| 10 | "down to **leaf** pages holding the actual values" | IMPRECISE (minor) | DDIA: databases overwhelmingly use a **B+tree**, where only leaves hold values/row-pointers and internal pages hold keys-only. The chapter's `<Define term="B-tree">` says internal pages hold "keys and references to child pages" (B+tree-correct) but calling the whole thing a plain "B-tree" slightly conflates B-tree vs B+tree. Functionally fine for the lesson. | Optional: add "(databases use the B+tree variant — values live only in leaves)." Not a real error. |
| 11 | "A B-tree's basic write **overwrites a page in place**; a page split overwrites several pages; crash mid-split corrupts the tree (orphan/torn page). Fix: **WAL** (filesystem people call it *journaling*)… durable once in the WAL and `fsync`'d." | CORRECT | DDIA "Making B-trees reliable": in-place overwrite, dangerous splits, WAL/redo-log written before pages, crash recovery by replay. journaling analogy is standard. | Leave. |
| 12 | "Both families use a WAL for durability — LSM to recover the memtable, B-tree to survive in-place page overwrite. Same tool, different fear." | CORRECT | DDIA: LSM WAL recovers in-memory memtable; B-tree WAL protects in-place page writes. Accurate distinction. | Leave. |
| 13 | "**LSM-trees better for writes, B-trees better/more predictable for reads.** LSM = big **sequential** flushes; B-tree = small **random** page writes; LSMs lower **write amplification**; B-tree reads ≈1 page/level, predictable." | CORRECT | DDIA "Comparing B-Trees and LSM-Trees": "LSM-trees are typically able to sustain higher write throughput… (lower write amplification… sequential)"; B-trees more predictable reads. | Leave. |
| 14 | "**Write amplification** = bytes actually written to disk ÷ bytes the application asked to write. 100-byte write → 600 bytes ⇒ 6×… wears out SSDs (limited write cycles)." | CORRECT | en.wikipedia.org/wiki/Write_amplification: "data written to the flash memory / data written by the host"; "actual amount physically written is a multiple of the logical amount." | Leave. |
| 15 | "flash can be **written** one ~4 KiB page at a time but only **erased** one ~512 KiB block at a time… scattered random writes leave blocks half-valid, forcing the SSD's **garbage collector** to relocate live pages before erasing." | CORRECT | en.wikipedia.org/wiki/Write_amplification: flash "must be erased… in… block" sizes ≫ page; GC relocates valid pages, the root cause of WA. Page≈4 KiB / block≈hundreds of KiB–MiB is representative. | Leave. |
| 16 | "**The Go angle:** `file.Write` can be lost in a crash; call `file.Sync()` — Go's wrapper around `fsync` — to force the WAL durable. Prefer `os.OpenFile` + `O_APPEND`, `bufio.Writer`, then `Sync()` at commit; `slices.SortFunc` (Go 1.21+) to keep a flush sorted." | CORRECT | DDIA durability + standard `fsync` semantics; `os.File.Sync` documents calling fsync; `slices.SortFunc` landed in Go 1.21. All accurate. | Leave. |
| 17 | "**Bloom filter** = bit array + a few hashes; **no false negatives**, occasional **false positives**… ≈**10 bits/key → ~1% false positives**." | CORRECT | en.wikipedia.org/wiki/Bloom_filter: "False positive matches are possible, but false negatives are not"; "about 9.6 bits per element… for a 1% false positive probability" ("fewer than 10 bits"). | Leave. |
| 18 | "QuickCheck: write-heavy ledger ingest → **LSM** (sequential flushes, lower write amp); occasional point lookup served by Bloom filters." | CORRECT | Follows from #13/#14/#17; matches DDIA's write-heavy recommendation. | Leave. |
| 19 | "**Row-oriented** = all of a row's fields together (OLTP); **column-oriented** = all values of one column together (OLAP)… reads only the needed columns; compresses far better (a column's values repeat). BigQuery, Snowflake, DuckDB, Parquet are columnar." | CORRECT | DDIA ch.3 "Column-Oriented Storage": exactly this layout + better compression from low-cardinality columns; named columnar systems are correct. | Leave. |
| 20 | Exercise-5 numbers: "LSM amp = 2 + compactions (e.g. 3 levels → 5); B-tree amp = 1 + pageBytes/recordBytes (8192/100 ≈ 82)." | CORRECT (as a simplified model, hedged) | Arithmetic checks (1 + 8192/100 = 82 via integer div). The chapter explicitly labels it a model and says "always measure your workload." Real LSM write amp is often higher (leveled can be 10–30×), but the chapter hedges. | Leave (already hedged). |

## Tally
- Rows examined/flagged here: 20
- WRONG: 0
- OUTDATED: 0
- IMPRECISE: 1 (#10 — "B-tree" vs "B+tree" leaf/value conflation; cosmetic, the Define text is already B+tree-correct)
- UNVERIFIABLE: 0
- CORRECT: ~19 load-bearing claims confirmed against sources. This chapter is the cleanest of the three — every numeric/mechanical claim (Postgres 8 KiB page, ~3–4 B-tree reads, ≈10 bits/key Bloom 1% FP, write-amp definition, size-tiered vs leveled direction, sequential-vs-random flash erase asymmetry, WaitGroup/slices versions) checks out.

**Worst finding:** #10 — calling the structure a plain "**B-tree**" while describing B+tree behavior ("leaf pages holding the actual values"). Databases use the B+tree variant (values only in leaves; internal nodes keys-only). The chapter's own `<Define>` body is already B+tree-accurate, so this is terminological, not a wrong mental model — recommend a one-clause clarification at most, no flag needed.

## Sources fetched (this chapter)
- https://github.com/facebook/rocksdb/wiki/Leveled-Compaction
- https://github.com/facebook/rocksdb/wiki/Universal-Compaction
- https://www.postgresql.org/docs/current/storage-page-layout.html
- https://en.wikipedia.org/wiki/B-tree
- https://en.wikipedia.org/wiki/Bloom_filter
- https://en.wikipedia.org/wiki/Write_amplification
- https://pkg.go.dev/sync#WaitGroup.Go (shared with replication audit; slices.SortFunc 1.21 corroborated via Go release history)

Frontmatter unchanged: yes (report-only; no file edited).
