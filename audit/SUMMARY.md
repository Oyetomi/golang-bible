# The Go Bible — Accuracy Audit Summary

Three-layer accuracy audit, **report-first** (no chapter edits applied). This is the
review artifact: read it, then approve a fix pass.

## Coverage

| Layer | Scope | Status |
|---|---|---|
| 1 — Code execution | all 1,653 Go blocks, 87 chapters | **complete** → `code-execution.md` |
| 3 — Structure & links | CodeWalk refs, cross-refs, manifest, render | **complete** → `structure.md` |
| 2 — Technical claims | WebFetch-verified, per chapter | **65 of 87 chapters** → `claims/<slug>.md` |

**22 chapters not yet claim-audited** (subagent session limits cut the fan-out short):
idiomatic-go-mindset, project-cinema-booking, tooling-engineering-hygiene,
configuration-secrets, production-project-architecture, broken-access-control,
resilience-correctness-under-load, fintech-capstone, dsa-graphs, dsa-binary-search,
dsa-backtracking, dsa-dynamic-programming, dsa-greedy-intervals-bits, dsa-interview-craft,
and the 6 Go-Mistakes appendix chapters (13–18). Layers 1 & 3 already cover **all 87**.

Across the 65 audited chapters, agents fetched **8–25 primary sources each** (the
framework's no-memory rule held — every WRONG verdict quotes a refuting source line).
The course is **technically strong overall**: most chapters returned 0 WRONG, and the
load-bearing internals (memory model, scheduler constants, GC non-generational,
slice growth, Swiss-table maps, select uniform-random, money-as-int64, exactly-once
framed as effectively-once, CAP/FLP/Raft) are correct.

---

## The dominant pattern: fabricated / mis-pinned Go versions

The single most common defect class. The course confidently pins behavior to a Go
version that's wrong — usually inventing a "1.22/1.24/1.26" attribution for something
older, or for something that never changed in that version. **This is the #1 thing a
fix pass should target**, because each is a clean falsifiable error a reader will trust.

| Chapter | Claim | Reality |
|---|---|---|
| context-package, context-in-production | "Go 1.22 replaced a **global tree mutex** with per-`cancelCtx` locks" (stated ×3 across 2 chapters) | **Fabricated.** Go 1.22 notes have no context change; `cancelCtx` has had a per-instance mutex since 1.7; no global tree mutex ever existed |
| context-package | "Since Go 1.21 `WithValue` panics on nil/non-comparable key" | Panic is original (1.7), not 1.21 |
| advanced-sharp-tools | `unsafeptr` vet analyzer "introduced in Go 1.22" (×3) | Predates 1.22; not in 1.22 notes |
| networking-web-fundamentals | `X25519MLKEM768` PQ key-exchange "default as of Go 1.26" | Default since **1.24**; 1.26 enables different hybrids |
| deployment-cicd-kubernetes | "Use Rewrite not Director (Go 1.26); Director deprecated 1.26" (×4) | `Rewrite`/`ProxyRequest` added + `Director` deprecated in **1.20** |
| dsa-arrays-strings | "As of Go 1.24 `slices.Sort` uses pdqsort" | pdqsort since **1.19** |
| dsa-complexity-go-toolbox | slice-growth + GC-shape stenciling "as of Go 1.24" | Both date to **1.18** |
| building-shipping-binaries | `ReadBuildInfo` "includes module path/deps since Go 1.21" | Predates 1.21 (modules era); only VCS auto-embed is 1.18 |
| application-security-baseline | `crypto/tls` TLS-1.2-minimum default "Go 1.24" | Default since **1.18** |
| performance-engineering | FlightRecorder "Go 1.23+" in Recap | **1.25** (chapter's own body says 1.25 — self-contradicts) |
| go-scheduler-gmp | work-stealing "introduced Go 1.14"; several runtime/metrics "Go 1.26" | Work-stealing since **1.1** (1.14 = async preemption); metrics since 1.16/1.17 |
| project-blog-aggregator | "ioutil.ReadAll removed in 1.16" | **Deprecated** in 1.16, still present in 1.26 |
| test-driven-development | `go test` result cache "As of Go 1.26" | Long-standing (~1.10) |
| reliability-patterns | HTTP/2 RST_STREAM cancellation "Go 1.24" | No such 1.24 change (UNVERIFIABLE) |
| background-jobs | "River uses Go 1.24+ generics" | Generics since 1.18 |

---

## Confirmed WRONG facts / mechanisms (fix these)

Beyond version pins, the genuinely wrong claims with the highest blast radius:

| Chapter | Defect | Fix |
|---|---|---|
| **generics** | GC-shape grouping rule stated as "same **size**" — `int`/`int64` "share one stencil." Recurs in prose + Scene + 2 ExecTimelines. | Rule is "same **underlying type**, or both pointer types." `int`/`int64` are *different* shapes. (1.18 design doc explicit) |
| **performance-engineering** | `sync.Pool` "cleared at **every** GC cycle" | False since **1.13 victim cache** — objects survive ~2 GCs |
| **performance-engineering** | GOMEMLIMIT a "hard ceiling" | It's **soft** (gc-guide: "makes no guarantees… under all circumstances") |
| **generics** | `maps.Keys(...) []K` "returns a slice" | Returns `iter.Seq[K]` (1.23); chapter's own example uses the iterator form |
| **grpc-service-communication** | `Money{4999,…}` encodes to `…c7 27…` | `c7 27` = varint **5063**, not 4999 (Exercise 1 decodes it correctly → self-contradiction) |
| **file-servers-cdns** | "`http.ServeContent` derives ETag from modTime+size" | It does not; only sets `Last-Modified`. Exercise's 304 round-trip can't fire |
| **caching-redis**, **microservices** | `wg.Go(func(){…}())` and single-value `errors.AsType[*T](err)` | Won't compile: `wg.Go` takes `func()` (no trailing call); `AsType` returns `(E, bool)` |
| **watermill** | `middleware.NewPoisonQueue(...)` + `.Middleware` field | Real API `middleware.PoisonQueue(pub, topic)` returns the middleware directly — 2 compile errors |
| **event-driven-kafka** | "segmentio/kafka-go supports cooperative-sticky" (Scene + ExecTimeline animate it) | kafka-go ships only eager Range/RoundRobin/RackAffinity |
| **external-payment-systems** | webhook HMAC over raw body only | Stripe signs `timestamp + "." + body`; as written rejects every real Stripe webhook |
| **security-financial-systems** | "Keyczar timing attack on HMAC-**MD5**"; "2016 GCM nonce-reuse on **TLS 1.3** candidates" | Keyczar was **HMAC-SHA1**; the GCM attack hit deployed **TLS 1.2** servers |
| **security-financial-systems** | `runtime/secret` `Value[T]` zero-on-GC API | 1.26 notes describe no such API; omits `GOEXPERIMENT` flag |
| **representing-money** | "5 credits of $0.10 ≠ 0.50, differs ~5.5e-17" | Ran it: `0.1×5 == 0.5` is **true** (errors cancel at step 5); drift appears at 6+ |
| **representing-money** | int64 holds "~92 trillion dollars" | ~92 **quadrillion** dollars (~9.2 quintillion cents) |
| **double-entry-ledgers** | "double-entry invented by Venetian merchants 1400s" | Florentine, late 1200s–1300s; Pacioli only *published* it (Venice 1494) |
| **transactions-consistency** | Postgres picks deadlock victim "lower cost to abort" | Docs: "difficult to predict, should not be relied upon" |
| **context-in-production** | `context.WithoutCancel` "copies the parent's deadline" | Doc: "no Deadline or Err, Done is nil" — could cause a real bug |
| **time-clocks-timers** | monotonic-strip list omits `In`/`Local`/`UTC`/`AddDate` | All four strip monotonic; chapter's own demos call `.UTC()` |
| **testing** | a mutex/rwmutex-blocked goroutine counts as durably blocked for `synctest.Wait` | synctest docs: locking a Mutex is **NOT** durably blocking — teaches the exact mechanism wrong |
| **docker-containerization** | `distroless/static` "adds a minimal glibc" | `static` has **no libc** (glibc is in `distroless/base`); contradicts own Define |
| **debugging-go** | self-deadlock demo comment "Two goroutines" | Code is single-goroutine non-reentrant double-`Lock` (label only; demo by-design) |

Plus many **IMPRECISE** (happens-before vs "synchronized before" wording, B+tree called B-tree, "hard"/"every" overstatements) and **UNVERIFIABLE** (unsourced perf multipliers) — see per-chapter files.

---

## Layer 1 — Code execution (full detail in `code-execution.md`)

- **948 stdlib `package main` blocks run; 654 fragments parse clean (0 malformed).**
- **One true bug in runnable code:** `batch-large-file-processing` GoPlayground blocks
  import `bufio` but never use it → won't compile. (Confirmed by the claims agent too.)
- **Platform note (corrected):** the live Codapi playground was tested directly and runs
  **Go 1.25.5**, so the `wg.Go` (Go 1.25) blocks **do** run for students. My initial
  Layer-1 read (playground = 1.24) was wrong; only the *local* audit toolchain is 1.24.
  The remaining 1.26 feature (`generics` self-referential constraint) is correctly
  labeled "(Go 1.26)" and is a preview, not a live-runnable defect.
- Everything else failing `go run` is by-design (deliberate panic/deadlock teaching
  demos, cross-block project snippets, servers, `go:embed`, external deps).

## Layer 3 — Structure & links (full detail in `structure.md`)

- **CodeWalk refs:** 1 overshoot in 79 walks (`appendix/14`, 27>25). Otherwise clean.
- **Cross-references:** 26 chapter refs, **0 dangling**.
- **Manifest/frontmatter:** valid. **Render:** `pnpm build` 92/92.

---

## Recommended fix pass (gated on your approval)

1. **Version-pin sweep first** — it's the highest-volume, highest-confidence class and
   mostly one-line edits (fix the version number or drop the pin). ~15 confirmed above.
2. **The WRONG facts/mechanisms** — ~22 confirmed, each with a source-backed fix above.
   Three are compile-blockers (`bufio`, `wg.Go()` call, `errors.AsType` shape) and the
   generics GC-shape rule needs prose + 3 animations corrected.
3. **Finish the last 22 chapters' claim audit** (re-run the fan-out when limits allow)
   so the Go-Mistakes appendix and remaining Part-2/3 get the same treatment.
4. IMPRECISE/UNVERIFIABLE downgrades — lower priority, batch with the above per chapter.

Per the framework: fix when confident, leave `{/* ACCURACY */}` flags when not; re-verify
each edited chapter with lint + the code-exec harness; commit in reviewable PR batches
(branch first, stage named files only, never `git add -A`).
