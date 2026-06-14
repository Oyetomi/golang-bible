# Accuracy audit — observability

Chapter: `content/part-2/11-observability.mdx`
Scope: OpenTelemetry traces/metrics/logs, Prometheus, the three pillars, exemplars, W3C trace context, SLO/error-budget/burn-rate math, Go-version attributions. REPORT ONLY — no content file edited.

## Flagged / touched rows

| Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|
| "`crypto/tls` in Go 1.24 defaults to TLS 1.2 minimum with a safe cipher suite list" (line 684 — appears in the observability chapter's adjacent security-link prose? No — this line is in the *security* chapter; in observability the TLS-version attribution does not appear). N/A here. | — | — | — |
| Histogram default: "the default 11 buckets (`DefBuckets`)" and the inline list ".005 .01 .025 .05 .1 .25 .5 1 2.5 5 10" (lines 346, 407) | CORRECT | pkg.go.dev/.../prometheus: `var DefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}` — "Count: 11 buckets" | Leave. |
| "As of Go 1.24, the Prometheus Go client uses `sync/atomic` operations throughout; no mutex on the hot `Observe` path." (line 407) | UNVERIFIABLE | pkg.go.dev confirms counters use atomic ("atomic increments of the counter with optimal performance") but the doc gives **no** statement that *histograms* are mutex-free on `Observe`, and nothing ties this to "Go 1.24". | Downgrade: drop the "As of Go 1.24" pin and soften to "the Prometheus Go client uses atomic operations on the counter hot path." The histogram-specific "no mutex on Observe" claim is not sourceable — hedge it. |
| `slog` "added in Go 1.21" / "Go 1.21 shipped `log/slog`" (lines 128, 131, 295, 1135) | CORRECT | go.dev/doc/go1.21: "The new log/slog package provides structured logging with levels." | Leave. |
| "The `slog.LogValuer` interface, part of `log/slog` since Go 1.21" (line 260) | CORRECT (by inference) | go.dev/doc/go1.21 confirms `log/slog` shipped in 1.21; `LogValuer` is part of that initial package surface (the 1.21 doc describes the package but does not enumerate every interface). No separate version introduced it. | Leave; optionally note the doc doesn't enumerate the interface, but it shipped with the package. |
| slog `Record` "preallocates five attr slots inline (a `[5]Attr` array in the struct); the sixth and beyond spill to a heap slice" (line 295) | UNVERIFIABLE | The Go 1.21 release note does not state the inline-attr count; `go doc log/slog` internals were not fetched. The `nAttrsInline` constant is an unexported implementation detail. | Downgrade: hedge to "preallocates a small number of attr slots inline (an implementation detail)" rather than asserting exactly 5 as a hard fact, OR keep but add a "(implementation detail, may change)" note. The number 5 is plausibly correct but unsourced here. |
| "This is why `slog` is faster than `zap` on the hot path for low-attribute records as of Go 1.21." (line 295) | UNVERIFIABLE | No benchmark source fetched; comparative perf is workload-dependent and not in any primary doc. | Downgrade: soften to "this design keeps low-attribute log calls allocation-free" and drop the unqualified "faster than zap" claim, or hedge as "can outperform reflection-based loggers on the hot path." |
| W3C `traceparent` format `00-{trace_id}-{parent_span_id}-{flags}`; trace_id "128-bit hex value (32 chars)"; parent_span_id "64-bit span ID"; flags bit 0 (`01`) = "sampled" (lines 509, 610, 614) | CORRECT | w3.org/TR/trace-context: "version-format = trace-id \"-\" parent-id \"-\" trace-flags"; "trace-id = 32HEXDIGLC ; 16 bytes array identifier"; "parent-id = 16HEXDIGLC ; 8 bytes array identifier"; "The current specification assumes the version is set to 00."; sampled flag "represented as 01 in hex." | Leave. |
| Trace ID is "a 128-bit value"; span ID present (line 509) | CORRECT | OTel traces doc example: trace_id `5b8aa5a2d2c872e8321cf37308d69df2` (32 hex = 128 bit), span_id `051581bf3cb55c13` (16 hex = 64 bit). | Leave. |
| Span contains "start time, end time, status, and attributes" (lines 509, 513) | CORRECT | opentelemetry.io traces: span includes "Name, Start and End Timestamps, Attributes, Span Status (Unset, Error, or Ok), Parent span ID." | Leave. |
| Counter "Monotonically increasing… only goes up"; Gauge "up and down"; Histogram "buckets… percentiles" (lines 314–316) | CORRECT | opentelemetry.io overview: "counters for incrementing values, gauges for capturing current values, and histograms for capturing distributions of measurements." | Leave. |
| Burn rate: "1x means you'll exhaust the monthly budget in exactly 30 days — on target" (line 670) | CORRECT | sre.google/workbook: "a constant 0.1% error rate uses exactly all of the error budget: a burn rate of 1" over a 30-day window. | Leave. |
| "A burn rate of 14.4x means you'll exhaust it in roughly 50 hours. Alerting at 14.4x over a 1-hour window is the standard fast-page threshold (Google SRE Workbook)… 14.4x = consume 2% of monthly budget in 1 hour" (lines 670, 682) | CORRECT | sre.google/workbook Table 5-8: "Page" / "1 hour" long window / "5 minutes" short window / "14.4" burn rate / "2%" budget consumed. 30 days ÷ 14.4 ≈ 50 h. | Leave. |
| Scene/animation cell: "burn rate climbs to 50x — you'd exhaust the 28-day budget in 13 hours" (lines 76, 681) | CORRECT (internally consistent) | 28 days ÷ 50 ≈ 13.4 hours. Arithmetic checks out; not a spec claim. | Leave. |
| "the OTel trace ID *is* your correlation ID" (lines 545, 548) | CORRECT (conceptual, not a falsifiable spec claim) | Consistent with W3C trace-context propagation model. | Leave. |
| Prometheus "scrapes it every 15 seconds" (lines 305, 378) | CORRECT (presented as an example/convention, not a spec mandate) | 15s is the common default scrape interval; phrased as an example. | Leave. |

## CORRECT (verified, left silently): summary count

Verified-correct, load-bearing claims confirmed against fetched sources: **11** (DefBuckets values+count, slog@1.21, traceparent format, trace/span ID widths, span contents, metric type semantics, burn-rate 1x, burn-rate 14.4x/2%/1h, counter-atomic, W3C version 00, sampled flag). Plus several internally-consistent arithmetic/example claims left as-is.

## Sources fetched (URLs actually opened)

- https://opentelemetry.io/docs/concepts/signals/traces/
- https://opentelemetry.io/docs/specs/otel/overview/
- https://www.w3.org/TR/trace-context/
- https://pkg.go.dev/github.com/prometheus/client_golang/prometheus
- https://go.dev/doc/go1.21
- https://sre.google/workbook/alerting-on-slos/

## Tally

- WRONG: 0
- OUTDATED: 0
- IMPRECISE: 0
- UNVERIFIABLE (downgrade recommended): 3 — (a) "Go 1.24 … sync/atomic throughout, no mutex on Observe", (b) `Record` "[5]Attr" exact inline count, (c) "faster than zap as of Go 1.21"
- CORRECT (confirmed): 11+ load-bearing claims

**Worst finding:** No hard errors. The most consequential is the unsourced confident perf/internals claim that the Prometheus client is "`sync/atomic` throughout; no mutex on the hot `Observe` path" pinned "As of Go 1.24" — the histogram `Observe` path is not documented as lock-free and the 1.24 pin is unsupported. Recommend downgrading to the counter-only atomic statement that the source actually backs.

Frontmatter unchanged: yes (report-only; no content file touched).
