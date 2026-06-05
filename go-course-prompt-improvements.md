# Go Course Prompt — Revisions & Curriculum Additions

> A companion to `go-course-author-prompt.md`. **Part A** patches the prompt's structure and mandates (edits, not new chapters). **Part B** adds the missing/incomplete topics, written in your existing chapter style so they paste straight into the relevant Part. **Part C** ranks everything by priority. Nothing here loosens the persona's "teaching wins" rule or the Depth Mandate — it sharpens both.

---

## Part A — Prompt & Structure Fixes

These address the structural risks in the current prompt. Each is stated as a problem and a concrete change you can drop into the **Rules** / mandate sections.

### A1. Tame the maximalism with explicit tiering

**Problem.** Every concept is required to carry broken-down steps *and* a real scenario *and* an animation *and* a runnable playground *and* an "Under the Hood" layer, and every chapter must also ship 3–5 solved exercises, a CTF lab with a programmatic verifier, and a scoreboard. Across 50+ chapters that is more than a single response can hold; the model will truncate or silently degrade the hardest deliverables (animations and lab verifiers) while still claiming compliance.

**Change — add to Rules:**

> **Treatment tiers.** Each chapter declares a `treatment: flagship | standard` in its frontmatter. **Flagship** chapters (the marquee topics — Concurrency, the Scheduler, Generics, Performance, Double-Entry Ledgers, the two capstones) get the full mandate: multiple animations, full lab + scoreboard, the works. **Standard** chapters get *one* primary animation for the chapter's central mechanism (static diagrams or prose are allowed for the rest), 3 exercises, and a lab that may be self-graded rather than verifier-gated (see A4). This is a budget, not an excuse to go shallow — the Depth Mandate still applies to every chapter. The point is to spend the expensive visual/lab effort where it teaches the most, instead of spreading it so thin that everything truncates.

**Also add — a generation-order rule:**

> When a chapter would exceed one response, emit the **teaching content first** (prose, code, playgrounds, diagrams) as response 1, then the **interactive components** (animations, lab, scoreboard) as response 2. Never drop the lab/scoreboard to fit length — split instead (see A5).

### A2. Soften the "animate everything" rule into a graded one

**Problem.** "Every explanation gets a visual; anything with sequence/flow/state must be animated, never static, never prose" is over-constrained. Some ideas are clearest as one sentence or one static diagram, and a *wrong* animation of a runtime mechanism is worse than good prose.

**Change — replace the Visualization Mandate "Rule of thumb":**

> **Choose the lightest visual that teaches the idea.** Animate when the *point of the concept is something changing over time* — execution order, data moving, state transitions, a tree tearing down. Use a **static diagram** when the truth is structural and timeless (a memory layout, a type relationship, a package-dependency graph). Use **prose alone** when a sentence is genuinely clearer than any picture. Never animate something that doesn't move just to satisfy a quota, and never let visual polish stand in for a correct model.

### A3. Add an accuracy guardrail for runtime internals

**Problem.** The under-the-hood claims (GC phases, GMP scheduling, generics stenciling, channel internals) are the highest-risk-for-silent-error part of the course, and they drift between Go versions. Confident, polished, *wrong* internals are the worst outcome.

**Change — add to the Depth Mandate:**

> **Pin the version and flag uncertainty.** State the Go version each internals explanation assumes (default to the current stable release, and say which it is). Where runtime behavior is version-specific — timer GC, scheduler preemption, GC pacing, map internals — say so explicitly and name the version it changed in. When describing an internal mechanism, prefer language grounded in the spec or runtime source over confident hand-waving; if a detail is genuinely uncertain or implementation-defined, mark it as such rather than inventing specifics. **Every internals animation is a model, not a fact** — keep it conceptually faithful and label it as a simplification where it abstracts away real complexity.

### A4. Make the lab verifier realistic about what the runner can do

**Problem.** "The flag is derived from a hidden test passing / a clean `-race` run / a benchmark beating a target" requires real execution infrastructure. `go.dev/play` won't run the race detector against a hidden harness or gate on a benchmark threshold; Codapi is more capable but still not a turnkey CTF judge. As written, many labs will *look* like gated CTFs without actually being verifiable.

**Change — add to the Lab Mandate:**

> **Declare a verification tier per lab.** Each lab states how its flag is checked, choosing the strongest tier the runner actually supports:
> - **`verifier`** — a real check the runner executes (visible-or-hidden `go test`, `-race`, a benchmark threshold) gates the flag. Use this only for labs whose check the target runner can genuinely run.
> - **`self-check`** — the lab ships its *own* in-snippet assertions or a `main` that prints `PASS`/`FAIL`, so the reader sees correctness without server-side hidden tests. The flag is revealed by the snippet itself on success.
> - **`reference`** — the reader compares against a provided reference solution and an explicit rubric; honor-system, used only where execution can't decide correctness.
>
> Prefer `verifier`, fall back to `self-check`, use `reference` last. Never describe a lab as verifier-gated if the runner can't run the verifier.

### A5. Resolve the split-chapter ambiguity

**Problem.** "Depth over speed — split a heavy chapter into Part 1/Part 2 responses" collides with "every chapter ships its lab and scoreboard," with no rule for how the lab/scoreboard map onto a split.

**Change — add to Output Format:**

> **When a chapter is split across responses,** earlier parts carry the teaching content plus their quick-checks and exercises; the **lab and the scoreboard attach to the final part only**, and the scoreboard tallies the quick-checks and exercises from *all* parts of that chapter. One chapter = one lab = one scoreboard, regardless of how many responses it took.

### A6. Fix the front-loaded-internals ordering in Part 1

**Problem.** Part 1 teaches `unsafe`, reflection, and the *implementation* of generics (GC-shape stenciling + dictionaries) before Part 2 introduces the GC, the GMP scheduler, and the "when not to add abstraction" mindset that make those internals meaningful. A learner hits stenciling in Part 1 Ch. 5 having never met the GC.

**Change — pick one:**

- **Reorder (preferred):** In Part 1 Ch. 5 (Generics) and Ch. 7 (Advanced), teach the *usable* layer in full and defer the deep runtime internals (stenciling/dictionaries, the GC cost story, `unsafe` memory-layout work) to a short forward-referenced "Under the Hood" stub that explicitly says *"the full mechanism is covered in Part 2 once you've met the GC and scheduler."* This matches how the prompt already defers mechanical sympathy.
- **Or scaffold in place:** Keep the depth in Part 1 but precede each internals dive with a 2–3 sentence "you haven't met the GC/scheduler yet, here's the one thing you need for now" primer, and link forward to the Part 2 chapter that finishes the story.

Either way, add a line to the Depth Mandate: *"If a deep explanation depends on a mechanism taught later, give the minimum forward-referenced primer rather than assuming it — and link to where it's completed."*

### A7. Persona — keep it, add an intensity dial

**Problem.** The Homelander voice is well-constrained ("mock the code, never the learner," PG-13, teaching wins), but a needling-villain instructor whose whole bit is conditional approval will delight some learners and quietly demoralize others, especially beginners who are already anxious.

**Change — add to the persona's Hard Rules:**

> **Intensity is a dial, and it eases on struggle.** Default to a medium, comedic arrogance. When the reader is clearly new to a topic or has just gotten something wrong, the menace recedes and the *competent mentor* underneath does the actual teaching — still in voice, but encouraging rather than withering. The bit never punches down at a learner who's trying. (Optionally expose a single frontmatter knob, e.g. `persona_intensity: low | medium | high`, so the whole course can be dialed down in one place.)

---

## Part B — Curriculum Additions (drop-in chapters)

Written in your chapter format. Placement is noted for each. Tiered by how much they move the needle toward "badass."

### Tier 1 — the two biggest holes

**→ Part 1, new chapter adjacent to Docker (place after Ch. 22 Docker & containerization)**

**Building & shipping Go binaries** — the course has you *write* binaries but never *ship* them, and this is signature Go craft. **Cross-compilation:** `GOOS` / `GOARCH` and how one command on your laptop produces a `linux/arm64` binary with no cross-toolchain — the build matrix, and `go tool dist list` for what's possible. **The cgo / static-binary trap** (this directly de-risks the Docker chapter's `scratch` / `distroless` images): `CGO_ENABLED` defaults to on, and the moment cgo activates — often invisibly, via the default `net` or `os/user` resolvers — you get dynamic linking against libc and your `scratch` image crashes at runtime with a "no such file" that confuses everyone; building with `CGO_ENABLED=0` (and `-tags netgo,osusergo` where needed) restores a truly static binary. **Build metadata:** stamping version/commit/build-time with `-ldflags "-X main.version=..."`, and reading it back at runtime with `runtime/debug.ReadBuildInfo()` (plus the VCS info Go embeds automatically since 1.18) so a running service can report exactly what it is. **Reproducible builds** (`-trimpath`, pinned toolchain) ties back to the supply-chain chapter. **Releasing:** **GoReleaser** to turn a tagged commit into cross-compiled binaries, checksums, and a release — the missing last mile for the CLI tools you've already built. Animate one source tree fanning out into binaries for several OS/arch targets, and a `cgo`-on build failing inside `scratch` while the `CGO_ENABLED=0` build runs clean.

**→ Part 2, new chapter (place after Ch. 3 Context in production, or late Part 1)**

**Time, clocks & timers** — currently one bullet buried in the compliance chapter, and time is exactly where backends and fintech bleed. **Monotonic vs. wall clock:** `time.Now()` carries *both* readings, and subtracting two `Time`s uses the monotonic clock, which is why a correctly-written duration is immune to NTP steps and DST — and why mixing in a wall-clock value (or a time that crossed a serialization boundary, which strips the monotonic reading) produces the negative durations people see in production. **Timers and tickers without leaks:** the `Stop`-and-drain dance, why an unstopped `time.Ticker` leaks, and the Go 1.23 change to how unreferenced timers are garbage-collected and how `Timer.Stop`/`Reset` channel semantics tightened — exactly the version-specific runtime detail your Depth Mandate asks you to flag. **Injecting a clock for testability:** the perennial "how do I test code that calls `time.Now()`" — define a small `Clock` interface (`Now()`, `After()`, `NewTimer()`), inject it, and drive a fake clock in tests so a settlement window or schedule engine becomes deterministic. **Wall-clock correctness:** timezones and the IANA database, DST pitfalls, the reference-time layout (`2006-01-02 15:04:05`) and why it trips everyone, and `time.Time` storage/serialization (UTC at the boundary). Ties straight to context deadlines. Animate a wall-clock jump leaving a monotonic-based duration correct while a wall-based one goes negative, and a leaked ticker firing forever next to a properly stopped one.

### Tier 2 — important, finance-critical

**→ Part 3, expand Ch. 10 (Security for financial systems) into a full chapter, or split this out**

**Cryptography mechanics in Go** — Part 3 lists "encryption at rest/in transit" but never teaches *how*, which violates the course's own Depth Mandate on the one topic where shallowness is dangerous. **`crypto/rand` vs `math/rand`:** the single most important rule — `math/rand` (and `math/rand/v2`) is deterministic and must *never* mint a token, key, nonce, or idempotency value; `crypto/rand` is the only correct source, and getting this wrong is a real, review-passing vulnerability. **Symmetric encryption at rest:** AES-GCM via `crypto/cipher`'s AEAD interface, why a nonce must be unique per key and never reused, and what GCM authenticates. **Envelope encryption with a KMS:** generate a per-record data key (DEK), encrypt the data with it, encrypt the DEK with a key-encryption key (KEK) held in HashiCorp Vault / a cloud KMS, and store the wrapped DEK beside the ciphertext — so rotation and access control live in the KMS, not your codebase. **Field-level PII encryption** for the sensitive columns the ledger and compliance chapters depend on. **Constant-time comparison:** `subtle.ConstantTimeCompare` for HMACs and secrets, and why a naive `==` leaks timing — ties directly to the webhook-signature verification in Part 3's external-payments chapter. Animate a predictable `math/rand` stream next to an unpredictable `crypto/rand` one, and a DEK being wrapped by a KEK and stored alongside the data it protects.

**→ Part 2, fold into Ch. 2 (Error handling at scale)**

**The goroutine-panic footgun (add as a named section).** State the single rule that takes down more Go production than data races do: **an unrecovered panic in *any* goroutine crashes the entire process**, and `recover` only works inside a `defer` *in the same goroutine* — a parent cannot recover a panic from a goroutine it spawned. So every long-lived or per-request goroutine you launch needs its own deferred recover (or a small `go func` wrapper that provides one), and the HTTP server needs **panic-recovery middleware** so one bad request can't kill the service. Pair it with when *not* to recover (let truly unrecoverable state crash and restart). Animate a panic in a spawned goroutine taking the whole process down despite a `recover` sitting uselessly in the parent.

### Tier 3 — fold-ins to existing chapters (sections, not new chapters)

These are real gaps but smaller; add each as a section to the chapter named.

**→ Part 1 Ch. 5 (Generics):** **The modern generic stdlib.** The chapter teaches the *implementation* of generics but not the daily-driver APIs built on them — the `slices` and `maps` packages and `cmp` (Go 1.21+): `slices.Sort`/`SortFunc`/`BinarySearch`/`Contains`/`Index`, `maps.Keys`/`Values`/`Clone`, `cmp.Compare`/`Or`. Teaching stenciling without these is backwards from how people actually use generics.

**→ Part 1 Ch. 16 (HTTP servers) + cross-ref Part 2 Ch. 10 (Reliability):** **Server hardening knobs, by name.** "Timeouts everywhere" is stated abstractly, but the concrete `http.Server` fields default to *no timeout* and that is a Slowloris foot-gun: `ReadHeaderTimeout` (the cheap, must-set mitigation), `ReadTimeout`, `WriteTimeout`, `IdleTimeout`. Add `http.MaxBytesReader` to cap request bodies, and safe streaming/multipart handling for large uploads so a client can't OOM the server. Name the exact knobs — seniors set these reflexively.

**→ Part 2 Ch. 16 (gRPC):** **Protobuf schema evolution.** The chapter covers `.proto`, codegen, RPC types, and interceptors but not the *evolution* discipline that prevents rollout outages: `reserved` field numbers and names, **never reuse a field number**, why adding fields is wire-compatible while changing types or numbers is not, and how this dovetails with the expand-contract migration story already in the SQL chapter.

**→ Part 1 Ch. 15 (SQL & databases):** **Read replicas & read-after-write consistency.** The chapter is strong on pool tuning, `EXPLAIN`, N+1, and expand-contract, but stops at a single primary. Add: routing reads to replicas to scale, **replication lag** and the read-after-write anomaly (a user who just wrote doesn't see their own change), and mitigations (route a user's reads to the primary for a window, or use "read-your-writes" routing). This is the natural next scaling topic.

**→ Part 3, new chapter or large section (place near Ch. 9 Auditability):** **Batch & large-file processing.** The course leans heavily event/stream-oriented (Kafka, Watermill), but real fintech is batch-heavy: nightly **reconciliation** runs, **statement generation**, and ingesting bank files. Cover the formats the domain lives on — **NACHA / ACH** fixed-width records and **ISO 20022** XML (SEPA, wires, modern rails) — and the engineering: streaming-parse a multi-GB file without loading it into memory (`bufio.Scanner` limits, the `encoding/csv` and `encoding/xml` stdlib in streaming mode), **checkpointing and resumability** so a failed job restarts mid-file instead of from zero, and idempotent re-processing (ties to the idempotency chapter). Animate a large file being parsed in a streaming pass with a checkpoint advancing, so memory stays flat as records flow through.

---

## Part C — Priority Summary

If you fold in nothing else, do these in order:

1. **Time, clocks & timers** (Tier 1) — unglamorous, deterministic-time testing and monotonic-vs-wall correctness are where seniors quietly outperform; the single highest-leverage addition.
2. **Building & shipping Go binaries** (Tier 1) — completes the last mile the course skips, and the cgo/`scratch` trap actively de-risks the Docker chapter you already have.
3. **Cryptography mechanics** + **the goroutine-panic footgun** (Tier 2) — the two "looks fine in review, vulnerability/outage in prod" gaps; both are short and high-impact.
4. **The Tier-3 fold-ins** — slip each into its named chapter as you write that chapter; none is big enough to warrant its own slot, but together they close the "why didn't the course mention this" gaps.

And independently of the additions, **A1 (tiering)** and **A4 (lab verification tiers)** are the two structural fixes most likely to determine whether the course actually ships as specified rather than quietly degrading under its own ambition.
