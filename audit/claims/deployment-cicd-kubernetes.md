# Accuracy audit — deployment-cicd-kubernetes

Chapter: `content/part-1/27-deployment-cicd-kubernetes.mdx` (Tier-3 deploy chapter — light sweep of confident infra/internals/version facts).
REPORT ONLY — no content file was edited. Fixes are proposed, not applied.

Focus per brief: liveness/readiness probes, resource requests/limits, Go 1.25 container-aware GOMAXPROCS, rolling updates — checked vs kubernetes.io semantics, pkg.go.dev, and go.dev/doc/go1.25.

| Claim (as written) | Verdict | Source | Proposed action |
|---|---|---|---|
| (L367 heading, L371, L393, L1247) "Use `Rewrite`, not `Director` (Go 1.26)" / "**As of Go 1.26**, the `Director` field on `ReverseProxy` is deprecated in favour of `Rewrite`" | OUTDATED (wrong version pin) | pkg.go.dev/net/http/httputil: `Rewrite` field and `ProxyRequest` type were **added in Go 1.20**; `Director` is documented "Deprecated. Use Rewrite instead." The deprecation and the `Rewrite` replacement are **not new in Go 1.26 — they date to Go 1.20.** | Fix the "(Go 1.26)" / "As of Go 1.26" attributions → "since Go 1.20." The advice (use `Rewrite`; `SetXForwarded`; strip `Authorization`; at most one of Director/Rewrite set) is all correct — only the version is wrong. |
| (L397, L1247) "set **either** `Director` or `Rewrite`; the standard library documents that at most one may be set." | CORRECT | pkg.go.dev/net/http/httputil: "At most one of Rewrite or Director may be set." | None. |
| (L673–677, L1251) "**Go 1.25**: runtime reads cgroup CPU limits into default `GOMAXPROCS`; rounds fractional quotas up; will not set the default below 2 unless CPU affinity / logical CPU count is lower; `500m` → typically `GOMAXPROCS=2`, `2000m` → `GOMAXPROCS=2`" | CORRECT | go.dev/doc/go1.25 (cgroup-aware default) + pkg.go.dev/runtime: "the Go runtime rounds up to the next whole number"; "it will never set GOMAXPROCS less than 2 unless the logical CPU count or CPU affinity mask count are below 2"; default = min(logical CPUs, affinity count, cgroup quota/period). `500m`→quota 0.5→round up→1→floor 2 ⇒ 2. `2000m`→quota 2 ⇒ 2. Both examples check out. | None. (This is the most load-bearing version claim in the chapter and it is accurate, including the min-2 and round-up specifics.) |
| (L526–534, QuickCheck L789) Liveness vs readiness: liveness failure → restart container; readiness failure → removed from Service endpoints (no traffic), container keeps running | CORRECT | kubernetes.io probe semantics. | None. |
| (L657–659) "Requests = scheduler reservation; Limits = enforcement. Exceed memory limit → OOM-killed; exceed CPU limit → throttled (not killed)." | CORRECT | kubernetes.io resource-management semantics (memory limit → OOMKill; CPU limit → CFS throttling). | None. |
| (L472–473, L808–811, L876) Rolling update `maxSurge: 1` / `maxUnavailable: 0` → never drop below desired replicas; new pod gated on readiness before old pod terminated; rollback is a reverse rolling update | CORRECT | kubernetes.io Deployment rolling-update semantics. | None. |
| (L901–905) Readiness propagation window; SIGTERM → fail `/readyz` → keep serving for `terminationGracePeriodSeconds` (default 30s) → SIGKILL; kube-proxy updates iptables/eBPF after Endpoints change | CORRECT | kubernetes.io graceful-termination + Endpoints/kube-proxy semantics; default grace period 30s. | None. |
| (L448, L450, Gotcha) "A Kubernetes Secret is NOT encrypted by default — base64-encoded; enable encryption at rest / external secrets operator" | CORRECT | kubernetes.io: Secrets are base64-encoded, not encrypted at rest unless EncryptionConfiguration/KMS is enabled. | None. |
| (L776) "As of Go 1.26 and Kubernetes 1.30+, the relevant internal machinery is pure Go — controllers, scheduler, kubelet." | CORRECT (trivially) | Kubernetes core components are written in Go; statement is non-specific and true. | None. |

## Notes
- Only one defect: the `Director`/`Rewrite` deprecation is pinned to "Go 1.26" but it has been the case since **Go 1.20** (when `Rewrite`/`ProxyRequest` landed and `Director` was deprecated). Appears in the section heading (L367), body (L371, L393), and Recap (L1247) — fix all three to "since Go 1.20."
- The container-aware GOMAXPROCS block — the chapter's headline Go-1.25 claim, with concrete `500m`→2 / `2000m`→2 numbers — is fully source-confirmed (round-up + floor-of-2 behavior verified against pkg.go.dev/runtime).
- CI/CD, reverse-proxy, L4/L7, and cloud-provider material is application/infra-architecture and conceptually correct; no internals errors.
- CORRECT (verified) count: 9.

Sources fetched:
- https://pkg.go.dev/net/http/httputil
- https://go.dev/doc/go1.25
- https://pkg.go.dev/runtime

Flags proposed for human review: 1 — `Director`/`Rewrite` deprecation version pinned to Go 1.26 (OUTDATED; it is since Go 1.20), in L367/L371/L393/L1247.
Content file edited: no.
