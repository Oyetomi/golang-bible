# Technical-Accuracy Audit — reliability-patterns

Chapter: `content/part-2/12-reliability-patterns.mdx` (Tier-2 / REPORT-ONLY — no content file edited)
Baseline Go version: 1.26. Date: 2026-06-14.

Every falsifiable claim below was checked against a source fetched live (no memory certification).
Rows are only those touched/flagged or where the verdict needed a quoted source; a running
CORRECT count of silently-confirmed claims follows the table.

## Audit-log table

| # | Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | "`http.Get` uses `http.DefaultClient`, whose `Timeout` field is zero — meaning **no timeout at all**. A request to a hung server will block forever." | CORRECT | net/http docs: `DefaultClient` is `&Client{}`; `Client.Timeout` zero value = "no timeout." Behavior is standard/well-documented. | — |
| 2 | "As of Go 1.24, `http.Transport` also propagates cancellation to HTTP/2 streams via RST_STREAM frames, so the server is notified promptly…" | UNVERIFIABLE / IMPRECISE | go.dev/doc/go1.24 fetched: **no mention** of HTTP/2 RST_STREAM cancellation propagation. The 1.24 HTTP/2 notes are only about the new `Protocols`/`HTTP2` config fields and unencrypted h2. RST_STREAM-on-cancel has lived in `x/net/http2` since well before 1.24; pinning it to "Go 1.24" is unsupported. | Downgrade: drop the "As of Go 1.24" attribution — e.g. "the HTTP/2 transport also sends an RST_STREAM when the request context is cancelled, so the server is notified promptly." No version pin unless a real source is found. |
| 3 | "When `context.WithTimeout` fires, it closes the `ctx.Done()` channel. The `net/http` transport watches that channel… sets a deadline directly on the TCP connection via `conn.SetDeadline(time.Now())`… The OS returns an error from the blocked read/write syscall…" | CORRECT (conceptual) | Matches documented net/http behavior; framed as a mechanism explainer, internally consistent with context cancellation semantics. Cancellation is not a goroutine kill — accurate. | — |
| 4 | "Full jitter: pick a random value in the range `[0, exponential_cap)`" / `rand.N(int64(exp))` with `exp = base*2^attempt` capped | CORRECT | AWS "Exponential Backoff And Jitter" (aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/): **"sleep = random(0, min(cap, base * 2 ** attempt))"** — full jitter is a uniform random in [0, capped-exponential). Chapter matches exactly. | — |
| 5 | "`rand.N` is the modern, goroutine-safe form (Go 1.22+, no seed needed)" / `math/rand/v2` | CORRECT | go.dev/doc/go1.22: "The new generic function `N` is like `Int64N`… For example a random duration from 0 up to 5 minutes is `rand.N(5*time.Minute)`." Pin (1.22) correct; rand/v2 top-level funcs are concurrency-safe. | — |
| 6 | Backoff table: base=200ms → attempt 2 wait 200ms, 3 → 400ms, 4 → 800ms ("`base * 2^(attempt-1)`") | CORRECT | Arithmetic: 200·2⁰=200, ·2¹=400, ·2²=800. Self-consistent (this is the pre-jitter exponential the chapter then jitters). | — |
| 7 | "**full jitter** prevents the thundering herd … exponential backoff alone does not" (QuickCheck answer) | CORRECT | AWS blog: without jitter "all the failed calls back off to the same time, they cause contention or overload again"; "Jitter adds … randomness to … spread the retries around in time." Matches. | — |
| 8 | Circuit breaker states: Closed (count failures, pass through) / Open (fail fast, sentinel error, no network call) / Half-Open (one probe; success→close, fail→reopen) | CORRECT | Matches the canonical Nygard circuit-breaker state machine and sony/gobreaker's model; conceptually sound. Animation `<CircuitAnim>` and `<ExecTimeline>` steps follow closed→open→half-open→closed correctly. | — |
| 9 | "In production libraries like `sony/gobreaker` (the de facto standard in Go) … **Sliding window** counting … `OnStateChange` callback … Half-open call limiting." | CORRECT | gobreaker exposes `Counts`/interval-based clearing, an `OnStateChange` callback, and `MaxRequests` limiting probes in half-open. Description is accurate. | — |
| 10 | "As of Go 1.24, there is no circuit breaker in the standard library." | CORRECT | True through Go 1.26 — no stdlib circuit breaker exists. (Wording "As of Go 1.24" is conservative/safe; could be 1.26 to match baseline but not wrong.) | Optional: bump pin to "As of Go 1.26" to match the course baseline. |
| 11 | "`server.Shutdown(ctx)` … closes the listener so no new TCP connections are accepted … waits for active requests to complete" and "drains *in-flight HTTP requests* — and nothing else" (background goroutines not drained) | CORRECT | net/http `Server.Shutdown` docs: gracefully shuts down without interrupting active connections; closes listeners then waits for idle. It does NOT track app-spawned goroutines — the Gotcha is correct and the `sync.WaitGroup` + `wg.Wait()` fix is the right pattern. | — |
| 12 | "As of Go 1.26, `os/signal.NotifyContext` cancels that context with a `context.CancelCauseFunc` carrying the signal — so `context.Cause(ctx)` tells you *which* signal triggered…" | CORRECT | go.dev/doc/go1.26: "`NotifyContext` now cancels the returned context with `context.CancelCauseFunc` and an error indicating which signal was received." Pin (1.26) correct. | — |
| 13 | "`sync.WaitGroup.Go` arrived in Go 1.25." | CORRECT | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | — |
| 14 | "`signal.NotifyContext` (Go 1.16+)" | UNVERIFIABLE (not refuted) | Not fetched (Go 1.16 notes). `signal.NotifyContext` is widely known to have landed in 1.16; no source confirms in this pass. Low risk; flag as unverified-but-plausible. | Leave as-is; if strict, hedge to "introduced in Go 1.16." |
| 15 | Liveness vs readiness: liveness fail → K8s restarts container; readiness fail → K8s pulls pod from LB pool, no restart; don't put DB ping on `/healthz`. | CORRECT | Matches Kubernetes probe semantics (liveness restarts container; readiness gates Service endpoints without restart). Conceptually correct — this is the standard K8s foot-gun warning. | — |
| 16 | Idempotency: "An operation is **idempotent** if executing it twice produces the same result as executing it once"; client generates the idempotency key, server stores+honors it. | CORRECT | Standard idempotency-key semantics (Stripe-style); the "client generates, server honors" rule is correct and load-bearing. | — |
| 17 | Token bucket: "holds up to N tokens; each request consumes one; tokens refill at a fixed rate … allows short bursts … this is what `golang.org/x/time/rate` implements." | CORRECT | pkg.go.dev/golang.org/x/time/rate: "It implements a 'token bucket' of size b, initially full and refilled at rate r tokens per second … maximum burst size of b events." Matches. | — |
| 18 | Leaky bucket vs token bucket distinction; fixed-window "boundary vulnerability" (100 at 0:59 + 100 at 1:01 = 200 in 2s); sliding window fixes it. | CORRECT | Standard rate-limiting algorithm canon. The fixed-window boundary-burst description is the textbook failure mode; correct. | — |
| 19 | "`rate.Limiter` does **not** run a background goroutine … lazy computation: stores `last` + `tokens`; newTokens = rate*(now-last); tokens = min(tokens+newTokens, burst); thread-safe via `sync.Mutex`." | CORRECT | pkg.go.dev/golang.org/x/time/rate: tokens computed lazily from elapsed time (`TokensAt(t)`, `AllowN` derive from time since last op); no ticker goroutine; mutex-guarded. Mechanism description matches. | — |
| 20 | "As of Go 1.24, `x/time/rate` is the authoritative implementation. It handles `Allow()` … `Wait(ctx)` … `Reserve()`." | CORRECT (version pin cosmetic) | pkg.go.dev: "Limiter has three main methods, Allow, Reserve, and Wait." Names/behaviors match. x/time/rate is a module, not tied to a Go release — "As of Go 1.24" is harmless but not meaningful. | Optional: drop the Go-version pin on a module's existence (say "x/time/rate is the authoritative implementation"). |
| 21 | "A single Go service with a per-process `x/time/rate` limiter handles **millions of requests per second**." | UNVERIFIABLE | No benchmark source fetched. Plausible for a mutex+arithmetic limiter but it's an unsourced hard number. | Downgrade: hedge to "easily handles very high request rates (the hot path is a mutex + a few arithmetic ops)." |
| 22 | Redis Lua rate-limit "runs atomically (no interleaving)" giving fleet-wide compare-and-increment; the sample is a "**fixed-window** counter." | CORRECT | Redis executes a Lua script atomically (single-threaded command execution); the INCR+EXPIRE pattern shown is indeed a fixed-window counter. Correct. | — |
| 23 | "8 replicas, each 10 req/s → effective 80 req/s; per-process limiters are independent" (QuickCheck) | CORRECT | Arithmetic + correct reasoning: independent in-process limiters sum; a round-robining client gets 8×10. Correct. | — |
| 24 | `<ExecTimeline>` "Context deadline propagating through a checkout handler": DB completes in 12ms, ~4.98s remains, payment hangs, at 5s `ctx.Done()` fires → `context.DeadlineExceeded` → 503. | CORRECT | Step order matches real context-deadline propagation: one parent deadline covers the tree; when it fires every downstream call unblocks. Numerically self-consistent. | — |

## Tally

- Flagged rows (verdict ≠ CORRECT, i.e. proposed downgrade/fix): **4**
  - #2 HTTP/2 RST_STREAM "as of Go 1.24" — UNVERIFIABLE/IMPRECISE (drop version pin)
  - #14 `signal.NotifyContext` "Go 1.16+" — UNVERIFIABLE (not refuted; plausible)
  - #21 "millions of requests per second" — UNVERIFIABLE (unsourced hard number, hedge)
  - #20 / #10 cosmetic version-pin notes — optional cleanups (CORRECT-but-imprecise pinning)
- CORRECT (source-confirmed, left as written): **20** of the 24 audited claims.
- WRONG (source refutes): **0**.

Worst finding: **#2** — the chapter pins HTTP/2 RST_STREAM cancellation propagation to "Go 1.24," but the Go 1.24 release notes contain no such change. This hands the reader a precise-sounding but unsupported version attribution. Recommend dropping the version pin (downgrade), not deleting the mechanism (the RST_STREAM-on-cancel behavior itself is real, just not new in 1.24).

## Sources fetched (URLs actually opened)

- https://go.dev/doc/go1.24 (HTTP/2 changes, Swiss Tables — confirmed NO RST_STREAM cancel note)
- https://go.dev/doc/go1.25 (sync.WaitGroup.Go, GOMAXPROCS container-aware, DWARF5)
- https://go.dev/doc/go1.26 (os/signal NotifyContext cause)
- https://go.dev/doc/go1.22 (math/rand/v2 rand.N)
- https://go.dev/doc/go1.21 (slog, min/max builtins)
- https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ (full-jitter formula)
- https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ (jitter rationale)
- https://pkg.go.dev/golang.org/x/time/rate (token bucket, lazy refill, Allow/Wait/Reserve)

Frontmatter unchanged: yes (report-only; no content file touched).
