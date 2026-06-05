# Proofread & Modernize Pass — Editor Guide

You are doing a **deep proofread + Go-1.26 modernization** of ONE already-written chapter. You EDIT the existing file in place — you do NOT rewrite it from scratch. Preserve its structure, persona, components, exercises, lab, scoreboard, and overall length. Make surgical improvements.

## Two jobs

### Job 1 — Deep proofread
Read the chapter end to end and fix:
- **Typos, grammar, punctuation, awkward phrasing.** Tighten wordy sentences. Keep the Homelander voice (confident, theatrical, backhanded praise) — don't flatten it.
- **Technical accuracy.** Every claim about Go must be correct. Fix anything wrong, outdated, or misleading. Verify the internals/"Under the Hood" claims are right.
- **Code correctness.** Every fenced `go` block and every `<GoPlayground>` must be valid, **gofmt-formatted** Go. Self-contained `package main` programs in `<GoPlayground>` must compile and run on stdlib alone (Codapi sandbox). Fix compile errors, wrong output comments, non-idiomatic code. Money is integer cents, never float.
- **Cross-references.** Phrases like "as we saw in the X chapter" / "covered in Part N" must point to real chapters (check `content/_manifest.json` for titles/parts). Fix wrong references.
- **Completeness vs the mandates.** Confirm the chapter still has: HeroCard, ChapterTabs (labels == H2 headings), ≥1 animated ExecTimeline for any sequence/flow, ≥1 UnderTheHood, runnable `<GoPlayground>` after self-contained snippets, 3–5 `<Exercise>` each with `<Solution>`, ≥2 `<QuickCheck>`, a `<Lab>`, a `<Scoreboard>` (last), a `<Recap>`. If something mandatory is missing, add it.

### Job 1.5 — Accuracy guardrails (apply to internals + labs)
- **Pin the Go version on every internals claim.** Any "Under the Hood" mechanism (GC phases, GMP scheduling, generics stenciling, channel/map internals, escape analysis) states the version it assumes (Go 1.26 baseline) and, where behavior is version-specific, names the version it changed in. Prefer spec/runtime-source-grounded language over confident hand-waving; if a detail is implementation-defined or uncertain, say so rather than inventing specifics. Treat every internals animation as a **model, not a fact** — keep it conceptually faithful; if it abstracts real complexity, add a one-line "this is a simplification" note.
- **Forward-reference primers.** If a deep explanation depends on a mechanism taught in a later chapter (e.g. the GC or scheduler, which are Part 2), give a 2–3 sentence "here's the one thing you need for now" primer and link forward to where it's completed — don't assume the reader already has it.
- **Lab verification tier (A4).** Make sure the chapter's `<Lab>` declares how its flag is actually checked, via the `verify` prop: `verify="verifier"` (the runner genuinely runs a `go test` / `-race` / benchmark threshold that gates the flag), `verify="self-check"` (the lab's own starter/snippet prints `PASS`/`FAIL` or asserts inline, so correctness is visible without a hidden server-side test), or `verify="reference"` (reader compares to a provided reference solution + rubric; honor system). Prefer verifier → self-check → reference. **Codapi runs plain `go run` only — it does NOT run `go test`, `-race`, fuzzing, or benchmarks.** So a lab whose check needs those is at best `self-check` (ship a `main` that exercises the code and prints PASS/FAIL) — do not label it `verifier`. Add the `verify` prop if missing and set it honestly.

### Job 1.7 — Scenario continuity (apply to every chapter, full strength)
Grounding every concept in a real backend/fintech scenario is already required; this adds **continuity**. Check and fix:
- **One scenario spine per chapter.** The chapter should commit to a SINGLE running scenario at the top and thread it through every section + the exercises + the lab — new concepts extend the SAME running system, not a fresh unrelated world each section ("scenario confetti"). If the chapter hops between unrelated scenarios, unify them onto one spine (a switch is allowed only with an explicit hand-off sentence). Don't rewrite wholesale — re-skin mismatched examples onto the spine.
- **One shared domain, named company = `Meridian`.** The whole course is set inside **Meridian**, a payments/ledger company. Use the recurring domain objects — `Account`, `Money` (integer cents), `Transfer`, `Ledger`, the `POST /transfers` endpoint, the payment webhook, the settlement/reconciliation job. **Replace generic placeholders** — `foo`/`bar`/`Widget`/`doSomething`, and the generic stand-in **"Acme"** → use Meridian and the domain objects. If the chapter already says "the ledger service," that's fine; prefer "Meridian's ledger" / "the Meridian ledger" for a name.
- **The "On the job" beat is required.** Each major concept must state, in one findable labeled line, WHEN you hit this in production and WHAT breaks if you get it wrong — e.g. a short `**On the job:**` sentence or a `<Callout kind="note">`. Add it where missing (especially before/after a concept's main visual). Keep it one line, concrete.
- **Reject wrong scenarios.** A realistic-but-incorrect scenario is worse than `foo`/`bar` (a mutex "protecting" something never shared; goroutines "speeding up" I/O-bound work). If a scenario misrepresents how the feature is actually reached in production, fix the scenario, not just the prose.

### Job 1.6 — Define every term & break concepts down (HIGH PRIORITY — projects especially)
The course's rule is "define every new term the instant it appears" and "break it down" — but PROJECT and HEAVY chapters routinely *use* a concept (idempotency, a ledger, Kafka, a payments service, a saga, the outbox, a mutex) assuming the reader remembers it. Fix that:
- **Define every load-bearing term on first use in THIS chapter**, even if an earlier chapter covered it — a one-line plain-language definition + WHY it matters + a link to the chapter that goes deep. Use the new **`<Define term="..." since="...">`** component for the important ones (idempotency, ledger, double-entry, Kafka, partition, saga, outbox, mutex, idempotency key, settlement, etc.). Example:
  ```mdx
  <Define term="Idempotency" since="Idempotency & Exactly-Once Semantics (Part 3)">
  An operation is **idempotent** if doing it twice has the same effect as doing it once. A payment "charge $50" must be idempotent: if the client retries after a timeout, you charge **once**, not twice. We need it because networks retry, and a retried charge that isn't idempotent **creates money out of nothing**.
  </Define>
  ```
- **Don't assume recall.** If the chapter says "we make the transfer idempotent" / "publish to Kafka" / "post to the ledger" without the reader being able to say what those mean from THIS page, add the definition.
- **Break dense passages into steps.** If a paragraph introduces several ideas at once, split it: lead with the problem, then the simplest model, then layer detail — one idea at a time. Define the term, THEN use it.
- This is required for every chapter, but it's the #1 fix for the **project chapters** (CLI, Pokedex, Blog Aggregator, Cinema, Fintech Capstone) — they must be self-contained enough that a reader who half-remembers the concept chapters can still follow, because every term is (re)defined where it's used.

### Job 1.8 — Real-world illustration (add a `<Scene>`)
Read `/Users/abbey/desktop/golang-bible/content/_ILLUSTRATION_MANDATE.md`. Every chapter must **illustrate the real-world problem pictorially, then animate the solution** — not only the code. If the chapter has NO `<Scene>`, add at least one near the top that depicts the chapter's core problem in the Meridian domain (concrete actors + a grid of seats/accounts/cache-slots/etc.) progressing through `beat: "problem"` → `beat: "solution"` frames, placed BEFORE the code that solves it. `<Scene>` is the domain-illustration counterpart to `<ExecTimeline>` (which animates code) — add Scene, keep the existing ExecTimelines. Keep captions short and grids ≤ ~40 cells. If a good Scene already exists, leave it.

### Job 2 — Modernize to Go 1.26
The chapter was written assuming **Go 1.24**. Current stable is **Go 1.26** (Feb 2026).
- Change version-baseline mentions "Go 1.24" → "Go 1.26" where they're a generic "current stable" note. Keep historical version attributions correct (e.g. "generics landed in 1.18", "loop vars fixed in 1.22" stay as-is).
- **Weave in the new 1.25/1.26 features that genuinely belong in THIS chapter** (your per-chapter assignment is in the prompt). Integrate them naturally — a new short section, an Under-the-Hood note, a `<Callout>`, an updated code example, or a Gotcha — NOT a bolted-on list. Prefer showing the modern idiom in the actual examples (e.g. use `wg.Go(func(){...})` instead of `wg.Add(1)`/`defer wg.Done()` where the chapter uses a WaitGroup).
- When you cite a feature, name its version ("as of Go 1.25", "new in Go 1.26").
- Don't force a feature in where it doesn't fit. Relevance over coverage.

## MDX safety (these break the build — never introduce them)
- **No backslash-escaped quotes inside double-quoted JSX attributes.** Use brace + JS string: `question={'… "x" …'}`.
- **No bare Go brace-syntax in prose or JSX text** — `interface{...}`, `struct{...}`, `map[T]struct{}`, `{int}`, a bare `{word}` — they evaluate as JS and crash render. Backtick them or put them in a fenced block. (Inside a JS string prop value like an ExecTimeline `note:` they're fine.)
- `<GoPlayground>` wraps a fenced ` ```go ` block as its child (NOT a `code={...}` prop). Normal `\n`, real tabs, gofmt.
- No MDX-level `import`/`export` lines. No hand-written `<NextUp>` (auto-rendered). Keep the persona sign-off as the final line.
- `<Callout>` `kind` must be one of: `note`, `warn`, `pro`, `tip`, `advanced`. Don't invent others.
- Don't change a chapter's frontmatter (title/part/order/type/description/prerequisites) — it must keep matching the manifest.

## Output
- Edit ONLY your assigned chapter file. Touch nothing else.
- Reply with: a short list of what you fixed (proofread fixes + features woven in), and confirm frontmatter is unchanged and still matches the manifest.
