# Accuracy audit — go-scheduler-gmp

Tier-1 internals chapter. Every falsifiable scheduler claim was checked against a fetched
primary source (Go runtime `proc.go` from the local Go 1.24.0 install, the official release
notes, and the `runtime/metrics` reference). Report-only; no edits applied.

## Findings (flagged claims)

| Claim (as written) | Verdict | Source | Proposed fix (NOT applied) |
|---|---|---|---|
| UnderTheHood: "A goroutine starts with a 2 KB stack (as of Go 1.4; **it was 4 KB before that**)." | **WRONG** | go.dev/doc/go1.4: "the default starting size for a goroutine's stack in 1.4 has been reduced **from 8192 bytes to 2048 bytes**." | Change "4 KB" → "8 KB". The pre-1.4 default was 8 KB (8192 B), not 4 KB. (The Recap line "starts at 2 KB" is correct and unaffected.) |
| Section header "**Scheduler metrics via runtime/metrics (Go 1.26)**" + code comment "`/sched/goroutines:goroutines` — current live goroutine count **(Go 1.26)**". | **WRONG (version attribution)** | pkg.go.dev/runtime/metrics confirms both metrics exist; go.dev/doc/go1.17: "a new metric tracking the distribution of goroutine scheduling latencies was also added" (`/sched/latencies:seconds`, 1.17). `/sched/goroutines:goroutines` dates to the package's introduction in Go 1.16. go.dev/doc/go1.26 only adds goroutine-*state* counts under `/sched/goroutines`, `/sched/threads:threads`, and `/sched/goroutines-created:goroutines`. | Don't attribute the two existing metrics to 1.26. `/sched/goroutines:goroutines` is since 1.16; `/sched/latencies:seconds` since 1.17. Reserve the "Go 1.26" tag for the genuinely new goroutine-state metrics, `/sched/threads:threads`, and `/sched/goroutines-created:goroutines`. |
| UnderTheHood: "work-stealing uses the **same algorithm introduced in Go 1.14**, with successive refinements to the idle-thread parking mechanism." | **WRONG (version attribution)** | Vyukov "Scalable Go Scheduler Design" + rakyll.org/scheduler: "Go has a work-stealing scheduler **since 1.1**, contributed by Dmitry Vyukov." Go 1.14 (go.dev/doc/go1.14) introduced **asynchronous preemption**, not work-stealing. | Change "introduced in Go 1.14" → "introduced in Go 1.1 (Vyukov's scalable scheduler)." Work-stealing and async preemption are distinct mechanisms from different releases. |
| ConceptCard (sysmon): "**Async preemption — Every ~10ms**, finds goroutines that have been running too long and sends SIGURG." | **IMPRECISE** | proc.go sysmon loop: poll interval starts at `delay = 20`µs and doubles "up to 10ms" (`if delay > 10*1000`); the *preemption threshold* is `const forcePreemptNS = 10 * 1000 * 1000 // 10ms`. | "Every ~10ms" conflates sysmon's polling cadence (20µs–10ms, adaptive) with the 10ms run-time threshold. Reword to "sends SIGURG to a goroutine that has held its P for more than ~10ms (`forcePreemptNS`)." The animation note already hedges this correctly, so this card is the only loose spot. |
| ConceptCard (sysmon): "Retake P from blocked syscall — If an M has been in a syscall for **more than 20µs**, sysmon retakes its P." | **IMPRECISE (true but conditional)** | proc.go `retake()`: comment "Retake P from syscall if it's there for **more than 1 sysmon tick (at least 20us)**" — BUT the code then has `if runqempty(pp) && nmspinning+npidle > 0 && pd.syscallwhen+10*1000*1000 > now { continue }`, i.e. if there's no other work and a spinning/idle P exists, retake is deferred up to 10ms. | The 20µs floor is right, but it's not an unconditional "retake at 20µs." Consider "at least ~20µs (one sysmon tick), but deferred up to ~10ms if there's no other work waiting." Optional tightening, not a hard error. |
| UnderTheHood (stealWork): "randomly scans up to `gomaxprocs` other Ps. When it finds a victim P with **more than one goroutine** in its queue, it locks the victim's `runqhead`/`runqtail`." | **IMPRECISE** | proc.go: `stealWork` runs `const stealTries = 4` passes over `stealOrder.start(cheaprand())`; it skips Ps flagged idle (`idlepMask`); `runqgrab` computes `n = n - n/2` (steal half, round up), which yields 0 for a single queued G unless `stealRunNextG` (only the last pass). So it effectively needs ≥2 queued Gs to steal a normal G — "more than one" is roughly right, but the "scans up to gomaxprocs Ps" understates the 4 retry passes, and on the final pass it will also try `runnext`. | Minor: note it makes up to 4 passes and that on the last pass it may also steal the victim's `runnext`. The "steal half" and pseudo-random victim claims elsewhere are CORRECT. |

## Silently-confirmed CORRECT claims (high-value, verified against source — not flagged)

- G/M/P model, M:N multiplexing, P as the G↔M intermediary — matches `runtime2.go` struct layout. ✓
- Local run queue is a ring buffer of **capacity 256** — `runq [256]guintptr` in `runtime2.go`. ✓
- `runnext` field bypasses the queue for a freshly-readied G — confirmed in `runtime2.go` comment + `runqgrab`. ✓
- Global-queue fairness check "**every `schedtick%61 == 0`**", 61 chosen to avoid rhythmic collisions — exact: `if pp.schedtick%61 == 0 && sched.runqsize > 0` with comment "Check the global runnable queue once in a while to ensure fairness." ✓
- Work-stealing **steals half** of a **pseudo-randomly chosen** victim's queue — `n = n - n/2` in `runqgrab`; victim order via `stealOrder.start(cheaprand())`. Comment: "Steal half of elements from local runnable queue of p2." ✓
- Idle P checks global queue + netpoller before stealing — confirmed (`schedule()` 61-check, `findRunnable`/`stealWork` ordering). ✓
- Async preemption added in **Go 1.14**, uses **SIGURG** on Unix; threshold ~10ms (`forcePreemptNS = 10*1000*1000`) — go.dev/doc/go1.14 ("Goroutines are now asynchronously preemptible… loops without function calls no longer… deadlock the scheduler"); `const sigPreempt = _SIGURG` in `signal_unix.go`. ✓
- SIGURG chosen because out-of-band data is "basically unused" — `signal_unix.go` comment confirms. ✓
- Windows uses `SuspendThread`/`ResumeThread` (no SIGURG) — confirmed in `os_windows.go`. ✓
- Async preemption can't interrupt cgo/un-annotated assembly — consistent with `preempt.go` async-safe-point logic + go1.14 platform caveats. ✓
- Netpoller uses epoll/kqueue/IOCP; **EPOLLET (edge-triggered)** on Linux — `netpoll_epoll.go`: `ev.Events = … | syscall.EPOLLET`. ✓
- Regular files don't use the netpoller (always "ready" to epoll) → blocking-syscall + P-handoff path — consistent with runtime netpoll design. ✓
- **GOMAXPROCS default changed in Go 1.25**: considers cgroup CPU bandwidth limit on Linux + periodic updates; disabled if set via env/`runtime.GOMAXPROCS`; `containermaxprocs`/`updatemaxprocs` GODEBUGs — go.dev/doc/go1.25 verbatim match. ✓
- **`runtime.SetDefaultGOMAXPROCS` (Go 1.25)** restores the runtime default "as if the GOMAXPROCS environment variable is not set" — go.dev/doc/go1.25 verbatim match. ✓
- `automaxprocs` now unnecessary for Go 1.25+, still correct for ≤1.24 — follows directly from the 1.25 release note. ✓
- Go 1.26 adds goroutine-state scheduler metrics under `/sched/goroutines` (the *new* additions) — go.dev/doc/go1.26 confirms (the version-tagging error above is only about the *pre-existing* two metrics). ✓
- Amdahl's law `1/((1-p)+p/n)`, ceiling `1/(1-p)`; 95% → 20×, 90% → 10× — arithmetic checks out (1/(1−0.95)=20). ✓
- Gustafson scaled speedup `n − (1−p)(n−1)` — standard form, correct. ✓
- Semaphore-via-buffered-channel pattern, GOMAXPROCS-sized; `select` for acquire+cancel; nil-map read note N/A here — code is correct and compiles. ✓

## Sources fetched

- https://go.dev/doc/go1.25 (GOMAXPROCS container-awareness, SetDefaultGOMAXPROCS)
- https://go.dev/doc/go1.14 (asynchronous preemption)
- https://go.dev/doc/go1.4 (goroutine stack size 8192→2048)
- https://go.dev/doc/go1.17 (scheduling-latency metric added)
- https://go.dev/doc/go1.26 (new scheduler metrics)
- https://go.dev/doc/go1.1 (scheduler — page copy abbreviated; corroborated below)
- https://go.dev/doc/go1.21 (no work-stealing change — negative confirmation)
- https://go.dev/doc/devel/release (release history)
- https://pkg.go.dev/runtime/metrics (/sched/latencies:seconds, /sched/goroutines:goroutines descriptions + existence)
- Local primary source: /usr/local/go/src/runtime/proc.go, runtime2.go, signal_unix.go, os_windows.go, preempt.go, netpoll_epoll.go (Go 1.24.0) — exact constants: `runq [256]`, `schedtick%61`, `forcePreemptNS = 10ms`, `n = n - n/2`, `sigPreempt = _SIGURG`, sysmon delay 20µs→10ms, `EPOLLET`, retake() 20µs/10ms thresholds.
- Corroborating secondary (Vyukov scheduler design): https://rakyll.org/scheduler/ ("work-stealing scheduler since 1.1, contributed by Dmitry Vyukov")

## Tally

CORRECT: ~22 (load-bearing claims verified, listed above) · IMPRECISE: 3 · OUTDATED: 0 · WRONG: 3 · UNVERIFIABLE: 0
