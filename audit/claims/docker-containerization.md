# Accuracy audit — docker-containerization

Chapter: `content/part-1/25-docker-containerization.mdx` (Tier-3 deploy chapter — light sweep of confident infra/internals facts).
REPORT ONLY — no content file was edited. Fixes are proposed, not applied.

Focus per brief: multi-stage, scratch/distroless, `CGO_ENABLED=0` static binary, layer caching, BuildKit — checked vs docs.docker.com and the distroless project docs.

| Claim (as written) | Verdict | Source | Proposed action |
|---|---|---|---|
| (L457) "Google's **distroless** images (`gcr.io/distroless/static-debian12`) … add a **minimal glibc**, timezone data, and a few other OS fundamentals" | **WRONG** | distroless `base/README.md`: "Statically compiled applications (Go) that do not require libc can use the `gcr.io/distroless/static` image" — static contains only ca-certificates, an `/etc/passwd` root entry, `/tmp`, tzdata. **glibc is in `distroless/base`, NOT `static`.** | Fix: `distroless/static-debian12` does **not** include glibc. Either (a) drop "minimal glibc" from the `static` description (it adds CA certs + tzdata + passwd, no libc), or (b) if you want the glibc variant, name `gcr.io/distroless/base-debian12`. Note the chapter's own `<Define>` (L452) is already correct ("timezone data and CA certificates", no glibc) and the CGO line (L468: "use `distroless/base-debian12` … includes glibc") is correct — only the L457 prose contradicts them. |
| (L452, L468) Define: "Distroless `static` = stripped Debian with timezone data and CA certificates, no shell"; "For a binary that links C libraries (CGO), use `distroless/base-debian12` which includes glibc." | CORRECT | Same distroless source: static = no libc; base = adds glibc/libssl for cgo/glibc apps. | None. (This is the correct framing the L457 prose should match.) |
| (L328) "Docker BuildKit (enabled by default since Docker 23)" | CORRECT | docs.docker.com Engine 23.0 release notes: "Set Buildx and BuildKit as the default builder on Linux. Alias `docker build` to `docker buildx build`." | None. |
| (L472, L488, L153) `CGO_ENABLED=0` → fully static binary, no dynamic linker / `ld.so`, runs in `scratch`; `ldd` reports "not a dynamic executable" | CORRECT | Matches Go's documented static-link behavior with cgo disabled; consistent with the next chapter's deeper treatment. | None. |
| (L143–151) OverlayFS: lowerdir (RO image layers) + upperdir (writable) + workdir; copy-up on first write to a lower-layer file | CORRECT | Standard OverlayFS / Docker storage-driver semantics. | None. |
| (L86, L113) Container = process under namespaces (isolation) + cgroups (limits), shares host kernel, no hypervisor; "six namespaces" | CORRECT (count is conventional) | Standard Linux container model; Docker conventionally lists 6 namespaces (PID, net, mnt, UTS, IPC, user) — cgroup namespace exists too but the "six" framing is the common teaching set. | None. (Optional: note a 7th cgroup namespace exists; not a defect.) |
| (L316, L862) "`ARG` … is part of the layer key — changing it busts the cache for everything below it; place `ARG` as late as possible" | CORRECT | Documented Dockerfile cache behavior: `ARG` value participates in cache keying for subsequent instructions. | None. |
| (L122) "union FS mounted … via OverlayFS … shares read-only image layers" (ExecTimeline step) | CORRECT | As above. | None. |

## Notes
- The single substantive defect is the L457 "static-debian12 … minimal glibc" line — a confident, wrong infra fact that contradicts both the chapter's own `<Define>` and the official distroless docs. Everything else in the chapter's infra claims checks out.
- CORRECT (verified) count: 7.

Sources fetched:
- https://github.com/GoogleContainerTools/distroless/blob/main/base/README.md
- https://docs.docker.com/engine/release-notes/23.0/
- https://docs.docker.com/build/buildkit/

Flags proposed for human review: 1 — line 457 (distroless `static` wrongly described as containing glibc).
Content file edited: no.
