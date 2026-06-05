# Scenario Mandate — Real-World Grounding

> A companion patch to `go-course-author-prompt.md` and `go-course-prompt-improvements.md`. This **sharpens the existing Explanation Mandate (rule #2, "Ground it in a real-world scenario")** rather than replacing it — the principle is already in the prompt; this makes it *enforceable* and adds the one thing it's missing: **continuity**. Like the improvements doc, it loosens nothing and tightens the teaching.

---

## Why this exists (and what's already covered)

The prompt already forbids `foo`/`bar` and already demands a concrete backend/fintech scenario per concept (Explanation Mandate #2; echoed in Output Format and the Lab Mandate). That part is good and stays.

**The gap is continuity.** "One scenario per *concept*" still lets a single chapter hop through six unrelated scenarios in six sections — the reader meets a fresh world every few paragraphs and nothing compounds. The hands-on courses this one is modeled on thread a *single* running scenario through a whole chapter, and a small shared domain through the whole course, so each new concept lands on a mental model the reader already holds.

So: keep grounding every concept. **Add a spine.**

---

## The three rules (drop into the Explanation Mandate, under rule #2)

> **2a. One scenario spine per chapter.** Each chapter commits to a *single* real-world scenario at the top and threads it through every section — intro, each sub-concept, the exercises, and the lab. New concepts extend the same running system rather than introducing a new unrelated one. Switching scenarios mid-chapter is allowed only when a concept genuinely doesn't fit the spine, and then only with an explicit hand-off ("leaving the ledger for a second — retries need their own example, here's why").
>
> **2b. One shared domain across the whole course.** The entire course is set inside one persistent domain — a payments/ledger company (name it to fit the persona; keep the name cosmetic). The same objects recur everywhere: `Account`, `Money`, `Transfer`, `Ledger`, the checkout endpoint, the payment webhook, the settlement job. When Part 1 teaches structs on an `Account`, Part 2 hardens the same handler, and Part 3 makes the same transfer correct under load, the reader is building *one* system across 50 chapters — not 50 disposable toys. The two capstones are this system, assembled.
>
> **2c. The "on the job" beat is required, not optional.** Every concept states, in one labeled line, **when you'd hit this in production and what breaks if you get it wrong** — e.g. "you meet this the first time two requests touch the same balance; get it wrong and you create or destroy money." This is already implied by Explanation Mandate #2 ("when they'd actually hit this on the job"); make it an explicit beat the reader can find, not a vibe.

---

## Interaction with the tiering rule (improvements doc A1)

Tiering throttles the *expensive* deliverables — multiple animations, verifier-gated labs — on `standard` chapters. **It must not throttle scenario-grounding.** Grounding is free: it's framing, not a React component or a CTF harness. So rules 2a–2c apply at **full strength to every chapter, flagship and standard alike.** A `standard` chapter may drop to one animation; it may never drop to `foo`/`bar`.

---

## Scenario catalog (draw from this; never reach for `foo`/`bar`)

A seed bank, by part. Extend it freely, but stay inside the shared domain.

**Part 1 — The Language**
- structs / methods / interfaces → modeling an `Account`, a `Money` amount, a `Transfer`
- slices / maps → a list of pending transfers; a balance lookup keyed by account ID
- concurrency → fanning out balance checks; a goroutine leak in a live request handler
- context → a cancellation tearing down a slow DB call when the client hangs up
- generics → a reusable `Set[T]` of seen idempotency keys
- SQL → the `accounts` / `transfers` tables; an N+1 loading each transfer's account; an expand-contract migration adding a `currency` column under live traffic
- HTTP servers → the `POST /transfers` endpoint; streaming a statement as NDJSON
- caching → caching an account *profile* (safe) vs. its *balance* (never); a 9am stampede on the dashboard

**Part 2 — Production engineering**
- error handling → the typed-nil trap returned from a repository's `FindAccount`
- scheduler → why the settlement worker (CPU-bound) starves the request handlers (I/O-bound)
- concurrency patterns → a worker pool draining the transfer queue; `errgroup` across three downstream calls
- reliability → a circuit breaker around the flaky card processor; a token bucket on `POST /transfers` per API key
- background jobs → the nightly reconciliation cron firing exactly once across three replicas via leader election
- observability → an SLO burn-rate alert when transfer latency climbs

**Part 3 — Fintech**
- money → a float silently dropping a cent across a million transactions
- ledger → a transfer posting a debit and a credit that must sum to zero
- transactions → two transfers racing on one account; a saga unwinding when step three (the external payout) fails
- idempotency → the same payment webhook delivered three times
- external payments → a retried charge that must not double-charge; an HMAC-verified inbound webhook
- capstone → all of the above, in one service

**Appendix — DSA (interview prep)**
- This track is explicitly *not* production backend work, so its scenarios are the problem statements themselves — but still concrete. Frame each problem in the domain where natural ("dedup transaction IDs," "top-K accounts by volume," "shortest settlement path between banks") rather than "given an array of integers."

---

## Anti-patterns (the mandate is also about what NOT to do)

- **`foo` / `bar` / `Widget` / `doSomething()`** — already banned; restated because it's the default the model slides back to under length pressure.
- **A *wrong* realistic scenario** — worse than `foo`/`bar`, because it teaches a confident but incorrect mental model of when the feature is used: a mutex "protecting" something never shared; goroutines "speeding up" CPU-bound work that's actually I/O-bound. If the scenario doesn't match how the feature is *actually* reached in production, it fails the mandate even though it looks concrete.
- **Scenario confetti** — a new, unrelated scenario every paragraph so nothing compounds. This is the gap rule 2a closes.
- **Scenario cosplay** — a scenario so elaborate the setup buries the concept. The scenario serves the teaching; if the reader spends more effort on the backstory than the mechanism, trim it.

---

> **Persona note (optional).** In voice, the instructor frames every scenario as a war story from "the systems I've personally saved" — but it's always the *same* system, and the lesson underneath is always real.
