# Contributing to The Go Bible

Thank you for your interest in contributing to **The Go Bible**.

## Development Setup

1. **Prerequisites**: Node.js 20+ and `pnpm` (recommended).
2. **Clone and Install**:
   ```bash
   git clone https://github.com/Oyetomi/golang-bible.git
   cd golang-bible
   pnpm install
   pnpm dev
   ```
3. Open `http://localhost:3000` in your browser.

## Quality Checks & Verification

Before opening a pull request, ensure all validation scripts pass cleanly:

```bash
# Everything the "Validate Content & Build" CI job runs, plus the
# stdlib snippet gate, in one command:
pnpm verify

# Or individually:
pnpm typecheck        # TypeScript
pnpm validate         # manifest structure & prerequisites
pnpm lint-mdx         # MDX syntax across all chapters
pnpm verify:snippets  # compile every stdlib Go snippet
pnpm build            # full production build
```

### The Go snippet gates

Every fenced `go` block that is a standalone program — `package main` **and** a
`func main()` — is compiled in CI. Three jobs, all blocking:

```bash
pnpm verify:snippets   # stdlib only, hermetic, no module proxy
pnpm verify:modules    # also builds snippets importing third-party packages
pnpm verify:vet        # runs go vet over both tiers
```

Run `pnpm verify:vet` before opening a PR — it is the superset, and it is the
job most likely to catch something the others miss.

You need Go installed. The corpus targets the release pinned as `GO_VERSION` in
`scripts/test-snippets.mjs`; `GOTOOLCHAIN=auto` will fetch it if your local Go is
older, so an older toolchain is fine.

**Third-party imports.** Dependencies are pinned in
`scripts/snippet-fixtures/go.mod`. If a chapter imports a package that is not
there yet, add it with `cd scripts/snippet-fixtures && go get <package>` and
commit the resulting `go.mod` and `go.sum`. Do not run `go mod tidy` there — the
module has no sources of its own, so tidy drops every requirement.

**When a snippet should not be compiled.** Two escape hatches, both written as
fence meta:

````
```go noverify
````
The snippet cannot build standalone by design — it continues a program defined
in an earlier fence, needs real files on disk for `go:embed`, or imports a
module that does not exist. It is skipped by every tier.

````
```go novet
````
The snippet compiles but `go vet` is *meant* to reject it — a chapter teaching
what vet catches has to be able to show code vet catches. It still gets
compile-checked.

Reach for these only when the snippet genuinely cannot pass; a failing gate is
usually telling you something true.

### Accuracy claims

`pnpm audit:versions` inventories every "added in Go 1.N" claim in the corpus and
flags ones that contradict a table of facts verified against the release notes.
It reports for review rather than gating, because one sentence may legitimately
name several releases. Findings to date are recorded in
[`content/_ACCURACY_AUDIT.md`](content/_ACCURACY_AUDIT.md) — read that before
re-auditing anything, so you do not repeat work.

## Authoring Guidelines

All course chapters must adhere to the standards outlined in [`content/_AUTHORING_CONTRACT.md`](content/_AUTHORING_CONTRACT.md):

- **Depth**: Ground every explanation in physical machine reality (memory layouts, CPU cache lines, scheduler run queues, system calls).
- **Concrete Scenarios**: Use real-world engineering scenarios (e.g. Meridian fintech backend, banking ledgers, Kafka streaming). Never use `foo`/`bar` filler.
- **Visuals**: Pair complex algorithms and state transitions with an interactive animation component (`AlgoGrid`, `LinkedListAnim`, `TreeAnim`, `GraphAnim`, `DPTableAnim`, `OutboxAnim`, `SagaAnim`, etc.).
- **Typography & Tone**: Clean typography with zero unicode emojis in prose and headers. Code snippets must be `gofmt`-clean and runnable.
- **Labs & Self-Checks**: End each chapter with an interactive `<Lab>` providing a self-check verification harness.
