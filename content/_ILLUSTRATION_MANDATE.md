# Real-World Illustration Mandate

> Every chapter and project must **illustrate the real-world problem, then animate the solution evolving** — not only the code. Readers understand a concept faster when they first *see the situation* (two users grabbing one cinema seat; two transfers hitting one balance; a cache stampede at 9am) before any Go appears. This sits alongside the Visualization Mandate: `ExecTimeline` animates **code execution**; `<Scene>` illustrates the **problem domain**.

## The rule

Each chapter gets **at least one `<Scene>`** near the top that *illustrates the core problem in the real world* — concrete actors and objects from the chapter's scenario (the Meridian domain by default), shown changing state across frames. As the chapter introduces the solution, either advance that Scene's frames into the fixed state, or add a second Scene showing the solution. The progression is **problem → solution**, pictorially.

- Lead with the problem Scene **before** the code that solves it.
- Mark frames with `beat: "problem"` (red accent) and `beat: "solution"` (green accent) so the turn is visible.
- Keep it the *real-world* picture: seats, accounts, users, requests, money — not boxes labelled "Step 1".
- This is required for **flagship and standard chapters alike** (it's framing, cheap, high-leverage). It does not replace the chapter's `ExecTimeline` code animations — it precedes them.

## The `<Scene>` component

Auto-injected (no import). Two visual elements, both optional, both animate across frames:
- **actors** — a row of labelled pills (the cast: `User 1`, `User 2`, `Meridian Pay`, `Replica A`).
- **a grid** — cells addressed by id (`A3`, …): cinema seats, account slots, cache entries, memory bytes. Use `rows` + `cols` to auto-generate an `A1..` grid, or pass explicit `cells`.

Each **frame** has a `caption` (the beat in words), a `beat`, and per-id state overrides for `actors` and/or `cells`. States (shared palette): `idle`, `active` (amber), `ok`/`done` (green), `warn` (amber pulse), `bad` (red shake).

### Example — the cinema double-booking (problem → solution)
```mdx
<Scene
  title="Two users, one seat"
  actors={[{ id: "u1", label: "User 1" }, { id: "u2", label: "User 2" }]}
  rows={2}
  cols={4}
  frames={[
    { caption: "Seat A3 is free. Both users are looking at it.", beat: "neutral",
      cells: [{ id: "A3", state: "idle" }] },
    { caption: "Both click A3 at the same instant.", beat: "problem",
      actors: [{ id: "u1", state: "active" }, { id: "u2", state: "active" }],
      cells: [{ id: "A3", state: "warn", label: "A3" }] },
    { caption: "No lock: both reads saw 'free', both writes win — A3 is double-booked.", beat: "problem",
      cells: [{ id: "A3", state: "bad", label: "✕✕" }] },
    { caption: "With a mutex: User 1 takes the lock and wins; User 2 is told 'taken'.", beat: "solution",
      actors: [{ id: "u1", state: "ok" }, { id: "u2", state: "idle" }],
      cells: [{ id: "A3", state: "done", label: "U1" }] },
  ]}
  caption="The same hazard as two transfers racing on one Meridian balance — one resource, two unsynchronised writers."
/>
```

### Reuse across domains (stay in the Meridian world)
- **balances / ledger** → a grid of accounts; frames show a balance read stale, a lost update, then the locked fix.
- **cache** → a grid of cache slots filling on a stampede; frames show many misses hammering the DB, then `singleflight` collapsing them.
- **scheduler / replicas** → actors as goroutines/replicas; frames show work piling on one, then balanced.
- **request flow** → actors as `Client`, `LB`, `Service`, `DB`; frames light up the hop sequence and a failure being contained.

## When to use which visual
- **`<Scene>`** — the situation in the world: who/what, what goes wrong, what fixes it. Always at least one, leading the chapter.
- **`<ExecTimeline>`** — what the *code* does over time (goroutines on lanes, steps firing). Still required where sequence/flow/state-change in code matters.
- **`<BeforeAfter>`** — naive vs idiomatic *code*.
- Static `<ConceptGrid>` / diagrams — structural, timeless facts.

Keep Scene captions short and concrete; keep grids small (≤ ~40 cells) so they stay legible full-bleed.
