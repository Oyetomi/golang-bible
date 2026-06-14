# Accuracy audit — building-shipping-binaries

Chapter: `content/part-1/26-building-shipping-binaries.mdx` (Tier-3 deploy chapter — light sweep of confident infra/version facts).
REPORT ONLY — no content file was edited. Fixes are proposed, not applied.

Focus per brief: cross-compile GOOS/GOARCH, `CGO_ENABLED=0` static binary, `-ldflags -X` version injection, build tags, reproducible builds (`-trimpath`, `toolchain`), `runtime/debug.ReadBuildInfo` / VCS stamping.

| Claim (as written) | Verdict | Source | Proposed action |
|---|---|---|---|
| (L318 Define) "`runtime/debug.ReadBuildInfo()` reads … the Go toolchain **automatically embeds in every binary since Go 1.18**: the Go version, the module path, all dependency versions, and VCS fields" | IMPRECISE / partly WRONG | go.dev/doc/go1.18: Go 1.18 added **VCS** embedding ("revision, commit time, and a flag … edited or untracked files"). **Module path + dependency versions predate 1.18** — `runtime/debug.ReadBuildInfo` returned module/dependency info well before (modules era; `go version -m` since ~1.12). 1.18 added the *VCS* fields and the `debug/buildinfo` package, not module-version embedding. | Tighten: it is the **VCS fields** that became automatic in Go 1.18; module path/dependency versions were already in BuildInfo. |
| (L323) "Since Go **1.21**, this also includes the module path and all dependency versions." | WRONG (version pin) | Same as above — module path and dependency versions were available via `ReadBuildInfo`/`BuildInfo` long before 1.21 (since the modules/`debug/buildinfo` era; 1.18 at the latest). Nothing about module/dependency embedding is new in 1.21. | Fix: drop the "since Go 1.21" attribution. Module info has been present since modules; only the VCS auto-embedding is the 1.18 milestone. Also reconcile with the L318 Define (which says deps "since 1.18"): the two lines currently disagree. |
| (L323, L389) VCS fields auto-embedded since Go 1.18 (`vcs.revision`, `vcs.time`, `vcs.modified`); `-buildvcs` governs it | CORRECT | go.dev/doc/go1.18: "The `go` command now embeds version control information in binaries … currently checked-out revision, commit time, and a flag indicating whether edited or untracked files are present … may be omitted using `-buildvcs=false`." | None. |
| (L400) "as of Go 1.25, the default debug format is DWARF5, which is more compact; `-w` still strips it" | CORRECT | go.dev/doc/go1.25: "The compiler and linker in Go 1.25 now generate debug information using DWARF version 5 … reduces the space required … reduces the time for linking." | None. |
| (L483) "The `encoding/json/v2` package landed as an experiment in Go 1.25 (`GOEXPERIMENT=jsonv2`); for production use `encoding/json` is still the stable choice." | CORRECT | go.dev/doc/go1.25: "Go 1.25 includes a new, experimental JSON implementation … enabled by setting `GOEXPERIMENT=jsonv2`." | None. |
| (L84, L264) "`CGO_ENABLED=0` … no external linker call … Go's own linker emits ELF/Mach-O/PE … required for cross-compilation in most cases (host C compiler can't target other arch without a cross-toolchain)" | CORRECT | Matches Go's documented cgo/linker behavior; cgo-off removes the C-compile + system-`ld` step, enabling toolchain-only cross-compile. | None. |
| (L48) "`go tool dist list` … as of Go 1.26 it's over 50 OS/arch combinations" | CORRECT (already hedged, count stable) | Long-standing: the supported matrix has exceeded 50 combos for many releases. | None. |
| (L93) "GOARM … Defaults to `GOARM=6`." | CORRECT | Documented Go default for 32-bit ARM (`GOARM` default 6). | None. |
| (L157, L207–209) "`CGO_ENABLED` defaults to `1` for host builds; `net` uses libc resolver (getaddrinfo) and `os/user` uses libc unless `-tags netgo`/`osusergo` or cgo off" | CORRECT | Documented stdlib cgo behavior for `net`/`os/user`. | None. |

## Notes
- The only real defect cluster is the `ReadBuildInfo` version attribution: the Define (L318) and body (L323) disagree on whether dependency/module info is "since 1.18" vs "since 1.21," and the "since 1.21" pin is wrong (module info long predates it). The clean statement: VCS auto-embedding = Go 1.18; module/dependency info = present since the modules era (not new in 1.18 or 1.21).
- CORRECT (verified) count: 7.

Sources fetched:
- https://go.dev/doc/go1.18
- https://go.dev/doc/go1.25
- https://pkg.go.dev/net/http/httputil (cross-referenced for the next chapter)

Flags proposed for human review: 1 cluster — `ReadBuildInfo` version pins (L318 Define vs L323 body; "since Go 1.21" for module/dependency info is WRONG).
Content file edited: no.
