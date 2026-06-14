# Accuracy audit — project-cli-tool

Chapter: `content/part-1/11-project-cli-tool.mdx` (Tier 3 — project chapter; light sweep. Internals/version claims only; application code not nitpicked.)
Mode: REPORT ONLY — no edits applied to the chapter.

## Audit log

| # | Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | (L457, L583, L698) `wg.Go` "new in Go 1.25" — calls Add(1)/Done() automatically. | CORRECT | go.dev/doc/go1.25: "The new `WaitGroup.Go` method makes the common pattern of creating and counting goroutines more convenient." | None. Correctly version-pinned. |
| 2 | (L696) "As of Go 1.25, Go's default `GOMAXPROCS` is container-aware: it considers logical CPUs, CPU affinity, and Linux cgroup CPU quota." | IMPRECISE | go.dev/doc/go1.25 names two 1.25 changes: cgroup CPU **bandwidth limit** (Linux) + **periodic re-check**; it does NOT list "CPU affinity" as a 1.25 GOMAXPROCS input. The container-aware claim itself is correct and the landmine ("defaults to NumCPU") is avoided. | Drop "CPU affinity" or hedge: "considers logical CPUs and the Linux cgroup CPU bandwidth limit (re-checked periodically)." Minor. |
| 3 | (L1055-1057 Callout) `testing/synctest` — "As of Go 1.25, the new `testing/synctest` package lets you run goroutines inside a fake clock where time advances only when all goroutines are blocked." | CORRECT | go.dev/doc/go1.25: "This package was first available in Go 1.24 under `GOEXPERIMENT=synctest`… The experiment has now graduated to general availability." + "the clock moves forward instantaneously if all goroutines in the bubble are blocked." GA in 1.25 is the right pin. | None. (Could note it was a 1.24 experiment, but "as of Go 1.25" for GA is accurate.) |
| 4 | (L744) `signal.NotifyContext` "is a thin wrapper introduced in Go 1.16." | CORRECT | pkg.go.dev/os/signal: NotifyContext "added in go1.16". | None. |
| 5 | (L980) test comment: "loop-variable capture is safe since Go 1.22". | CORRECT | go.dev/doc/go1.22: "Previously, the variables declared by a 'for' loop were created once and updated by each iteration. In Go 1.22, each iteration of the loop creates new variables, to avoid accidental sharing bugs." | None. |
| 6 | (L399) "An `int64` holding cents can represent every amount up to about $92 trillion without losing a single cent." | CORRECT | math.MaxInt64 = 9223372036854775807 cents ÷ 100 = $92,233,720,368,547.75 ≈ $92.2 trillion. Arithmetic checks out. | None. Also satisfies the "money as float anywhere = defect" landmine — chapter correctly uses int64 cents throughout. |
| 7 | (L690) Memory-model claim: "writes done by a goroutine before it sends on a channel happen-before the receive of that value." | CORRECT | go.dev/ref/mem: "A send on a channel is synchronized before the completion of the corresponding receive from that channel." The local-map-then-channel-send confinement pattern is genuinely race-free. | None. |
| 8 | (L744-748) `os/signal` internals: dedicated signal goroutine on a `sigqueue`; runtime catches signals in assembly (`sigtramp`); Windows maps SIGINT to `SetConsoleCtrlHandler`. | CORRECT (light) | Matches runtime os_signal / sigqueue design and os/signal Windows behavior. Not deeply re-derived (Tier 3); no confident-wrong mechanism. `sigtramp` is the real runtime symbol. | None. |
| 9 | (L234) flag package: accepts `-flag value`, `-flag=value`, `--flag value`; does NOT support combined single-letter flags `-abc`. POSIX-style. | CORRECT | Matches stdlib `flag` documented behavior (single/double dash equivalent; no bundling). | None. |
| 10 | (L230) Default `flag.CommandLine` uses `ExitOnError` → calls `os.Exit(2)` on parse failure. | CORRECT | stdlib `flag`: CommandLine is created with `ExitOnError`; on error it prints usage and calls `os.Exit(2)`. | None. |

## Summary

- Rows flagged: 1 (row 2 — IMPRECISE, "CPU affinity" not a Go 1.25 GOMAXPROCS input; minor).
- CORRECT (silent/listed): 9 of 10 audited claims fully correct.
- WRONG: 0. OUTDATED: 0. UNVERIFIABLE: 0.
- Money-as-float landmine: AVOIDED (int64 cents enforced at the type level). GOMAXPROCS landmine: AVOIDED.

Sources fetched:
- https://go.dev/doc/go1.25
- https://pkg.go.dev/os/signal
- https://go.dev/doc/go1.22

Frontmatter unchanged: yes (REPORT ONLY — no edits to chapter).
