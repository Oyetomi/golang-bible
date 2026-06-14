# Layer 1 — Code Execution Audit

**Method:** extracted all 1,653 fenced `` ```go `` blocks from 87 chapters, de-duped by
hash (1,646 unique), classified, then: `go run` every stdlib `package main` block,
`gofmt -e` parse-check every fragment, list external-dep blocks as not-executed.
Toolchain: **local `go1.24.0`** (note: the course targets **Go 1.26**; the live Codapi
playground runner was tested directly and is **Go 1.25.5** — see the correction under
Finding 1).

## Headline numbers

| Class | Count | Result |
|---|---|---|
| `package main`, stdlib (executed) | 948 unique | 839 run clean · 109 fail |
| Fragments (parse-checked) | 652 unique | **0 malformed** |
| External-dep (not executed) | 46 | illustrative — grpc/otel/watermill/kafka/websocket/x-deps |

The 109 `go run` failures break down as **mostly by-design**, with a small set of real
findings. Breakdown below.

## Finding 1 (CORRECTED — not a defect) — Go 1.25 APIs vs the audit toolchain

The course adopts modern idioms — most heavily **`sync.WaitGroup.Go` (added Go 1.25**,
confirmed in go.dev/doc/go1.25: *"The new `WaitGroup.Go` method makes the common pattern
of creating and counting goroutines more convenient"*). The **local audit toolchain is
go1.24.0**, which rejects it with `wg.Go undefined` — that is what produced the ~40
failures below.

**Correction:** a claims-audit agent tested the live `api.codapi.org` playground the repo
actually loads, and it reports **go1.25.5** (codapi.org states "Go version: 1.25"). The
exact `wg.Go` + `for i := range 3` pattern compiles and runs there. So these blocks
**run fine for students** — the failures are an artifact of the older *audit* toolchain,
not a course defect. The runtime is environment-dependent (not pinned in-repo), so it's
worth keeping an eye on, but as of today there is no broken-block issue here.

- The **14 `<GoPlayground>` blocks** flagged below use `wg.Go` and are listed only for
  completeness / the version-floor record — they are **not** broken on the live runner:

| Chapter | Playground blocks affected |
|---|---|
| part-1/04-concurrency | 4 |
| part-1/13-design-patterns-go | 2 |
| part-2/07-advanced-concurrency-correctness | 2 |
| part-2/08-project-cinema-booking | 2 |
| part-1/11-project-cli-tool | 1 |
| part-2/06-concurrency-patterns | 1 |
| part-3/05-messaging-pubsub-foundations | 1 |
| part-3/15-fintech-capstone | 1 |

- Also: `part-1/05-generics #27` uses a **self-referential generic constraint** marked
  `// (Go 1.26)` (`Adder[A Adder[A]]`) — same class: valid on the target, rejected by 1.24.
- `part-1/20-auth-api-design #23` uses `http.NewCrossOriginProtection` (CSRF protection,
  **Go 1.25**) — display block, not a playground.

**Net: no action needed** for `wg.Go` — the live runner is already 1.25. (Had the runner
been older, the fix would be to upgrade it, not to downgrade the correct idiom.)

## Finding 2 (real, low) — `bufio` imported but unused

`part-3/11-batch-large-file-processing.mdx` — the NACHA-streaming GoPlayground blocks
(#2 and #6) `import "bufio"` but the function signature is `(lines []string)` and never
uses it → `"bufio" imported and not used`, won't compile. **Real defect** in runnable
blocks. Fix: drop the import, or restore the `bufio.Scanner` streaming form the import implies.

## Finding 3 (minor) — display-block unused imports (excerpts)

A handful of non-playground display excerpts don't compile standalone because a use was
elided: `part-1/17-pokedex #3` (`context`), `part-1/19-http-servers #18` (`context`),
`part-2/03-context-in-production #1` (`sync`), `part-2/16-configuration-secrets #9`
(`fmt`). These are excerpts, not claimed-runnable — low priority, but trivially fixable.

## By-design (NOT defects — verified, no action)

- **Deliberate failure demos:** `part-2/09-debugging-go #0` (`panic: invalid transfer
  amount` — the section is *"Reading a panic and its stack trace"*), `#1` & `#9`
  (self-deadlock demos), `part-2/06 #28` (deadlock). The failure *is* the lesson.
  *(Minor: debugging #1's comment says "Two goroutines" but the code is a single-goroutine
  self-deadlock — prose nit, flag for the claims pass.)*
- **Cross-block project snippets:** chapters that build one program across several blocks
  (pokedex, double-entry-ledgers, resilience, perf-engineering, cinema-booking) emit
  `undefined: X` / `function main is undeclared` because the type/func/`main` lives in a
  sibling block. By design — not standalone-runnable.
- **Servers (run then block):** docker #0, http-servers, production-arch #6, several
  `:8080` listeners — they start correctly; the harness timeout / `address already in use`
  (parallel workers) is an artifact, not a code fault.
- **`go:embed` needing absent files** (`static`, `migrations/*.sql`), **TLS demos**
  needing `cert.pem`, **intentional startup-validation exits** (config-secrets demos that
  report a missing env var and exit) — all expected.
- **External/placeholder imports:** `nhooyr.io/websocket`, `go.opentelemetry.io/otel`,
  `example.com/logger`, `yourmodule/booking` — illustrative.

## Verdict

Code health is **good**. Only **one true bug in runnable code** (the `bufio` import) plus
one systemic platform issue (the 1.24 playground vs the course's 1.25/1.26 idioms, hitting
14 runnable blocks). Everything else is intentional or excerpt-by-design.
