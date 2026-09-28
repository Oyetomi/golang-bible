# Chapter Rebuild Standard (proofread + re-teach)

Read this with `_AUTHORING_CONTRACT.md` and `_ILLUSTRATION_MANDATE.md`. Where they
conflict, **this file wins**. It comes from the book's actual reader, who said:

> "everything feels rushed … i often lose track of whats happening"
> "all chapters just dump the info all at you, its overwhelming"
> "the examples just go on for long, just a dump and not well placed to understand"
> "its hard for me to read go code and keep a mental model … a function returning &{} so confusing"
> "the linear animations and illustrations dont cut it … imagine teaching concurrency, i need to know how the goroutines work and how they move"
> "i studied computer science but computer science isnt that strong"

The reader is smart and motivated, but **assume no CS foundations**. Memory, bytes,
addresses, pointers, stack vs heap, threads, what a compiler does, what "O(n)" means:
teach each one from zero, with a picture, the first time a chapter leans on it.
One sentence of `<Define>` is not enough when the whole section depends on the idea.

## The shape of every chapter

1. **Route map in the hero.** A numbered list of 4–7 stops, one line each, plus
   "If you get lost, come back here." Every H2 starts with `*Stop N of M.*`.
2. **One idea per step.** Inside a stop, use `### Step 1: …` headings. A step
   teaches exactly one idea. If a paragraph introduces two new ideas, split it.
3. **Picture before code.** The mental model comes first, as an animation or
   illustration of the actual mechanism. The code comes after, and it confirms
   the picture.
4. **Smallest example first.** Show the 2–8 line program that exhibits the idea
   before the realistic one. The realistic one comes last, and it's walked through.
5. **Why, not just what.** Every rule gets its reason (history, mechanism,
   the bug it prevents).
6. **Recap per stop, where a stop is long.** One or two sentences before moving on.

## Code: no dumps

- **Never show the same program twice.** One copy only: the runnable `<GoPlayground>`
  (keep teaching comments inside it). The site already folds `package`/`import`
  lines and clamps programs over 28 lines, so don't do that by hand.
- **Before any program longer than ~15 lines, say what to look for** ("Watch
  line 12: that's where the pointer escapes"). After it, show the real output
  in a ```text block and explain it.
- **Long programs get a `<CodeWalk>`**: 3–7 steps, each spotlighting the lines
  that matter, in reading order. `lines` are 1-based **within the fenced block
  inside the CodeWalk**. Count them. A wrong range is a bug.
- **Teach how to READ unfamiliar syntax the first time it appears.** For example,
  `return &Account{ID: id}` means "build an Account value, then hand back its
  address (a pointer to it)". Draw that as a box plus an arrow. Other patterns to
  translate this way: `*T` in a type versus `*p` in an expression, `:=`,
  `func (a *Account)`, `[]T{}`, `map[K]V{}`, `<-ch` versus `ch <-`, `x.(T)`,
  `...`, `_`, `defer`, `go f()`.

## Animations: strong, correct, and moving

The reader said stepped slideshows "don't cut it". Choose the strongest fit:

- **`<RuntimeStage>`** (components/course/RuntimeStage.tsx) is a continuous-time
  stage with a scrubber. Zones are real structures, and actors (gophers, value
  chips) glide on arcs, several at once. Use it whenever **several things move
  at once**: goroutines, queues, pools, pipelines, requests through a system,
  memory being allocated and collected. See the ch4 scenario for the event format
  (`at`, `id`, `to`, `state`, `carry`, `note`, `clock`, `beat`, `hot`).
- **Bespoke mechanism anims** (all in components/course/anim.tsx): `InterfaceAnim`
  (interface two-slot box), `RaceAnim` (read-add-write interleaving), `RendezvousAnim`
  (unbuffered handoff), `GoroutineAnim` (lanes, main-exit kills), `StackHeapAnim`,
  `SliceAnim`, `MapAnim`, `ChannelAnim`, `LockAnim`, `SchedulerAnim`, `GCAnim`,
  `LedgerAnim`, `CacheAnim`, `PoolAnim`, `IsolationAnim`, `CgroupAnim`,
  `OverlayAnim`, and others. **Read a component's props before using it.**
- `ExecTimeline`/`Scene` are allowed, but they're the weakest option. Don't make
  them the centerpiece of a mechanism.
- **Every animation must be correct.** If it shows the runtime, it must be what
  the runtime does. If you're unsure, write a program that proves the behaviour
  and run it.
- **Aim for a strong visual in every stop**, and at least one moving
  `RuntimeStage` or bespoke mechanism animation per chapter where anything moves.
- If a mechanism needs an animation that doesn't exist, **don't edit shared
  component files.** Use the best existing one, and describe the missing component
  in your final report (what it shows, its props, its frames) so it can be built centrally.

## The narrator

The book is taught by a Homelander-style superhero instructor, so it's never
boring. He speaks through `<Narrator>` (a caped gopher and a name tag), never
inside the teaching prose, so the facts stay plain and the voice stays his.

- **Where.** One `<Narrator>` right after the `HeroCard`, and one after the
  `Scoreboard` at the end. At most one more mid-chapter, at the chapter's most
  dramatic measured failure. Each line is 1–3 sentences, under about 60 words.
- **Who he is.** Vain and certain he's the best there is. Warm the way a
  threat is warm: praise that comes with conditions. Needs to be admired,
  and notices when he isn't. Contempt for sloppiness, not for the reader's
  background. Now and then, sincere, which is the most unsettling of all.
- **What he talks about.** The chapter's real result: quote the measured
  number ("twelve writes that changed nothing", "zero lost transfers"). He
  takes credit for the reader's wins and treats their bugs as a personal
  disappointment.
- **Moods.** `mood="smug"` (default, the smile), `mood="menacing"` (the eyes
  glow; for failures and warnings), `mood="sincere"` (rare).
- **Never.** Never inaccurate, never the show's dialogue or names (no
  "Homelander", no "Vought"), no gore, never cruel about who the reader is.
  The persona frames the lesson; it never replaces it.

## Proofreading

- **Facts:** verify every technical claim that matters. Run the code (it builds
  with Go 1.27 through the snippet test). Fix wrong claims. Past errors found in
  this book: "Go bytecode", "TLB flush on thread switch", "closing a channel you
  don't own panics", "cache incoherence causes races", a CodeWalk off by one line,
  and a timeline claiming a leak its own buffer prevented.
- **Language:** plain, short sentences. Define jargon inline. Cut filler and
  repetition. Keep the Homelander persona to framing and asides only: never in
  definitions or explanations, and never at the cost of clarity.
- **Versions:** the book targets Go 1.27. Name the version when citing a feature
  from 1.21+.

## Hard rules (the build breaks otherwise)

- Only edit the chapter files you were assigned. Don't touch components, the
  manifest, `_verified.json`, or other chapters.
- Keep the frontmatter unchanged. `<ChapterTabs>` labels must equal the H2 headings exactly.
- MDX safety: brace-wrap attribute strings that contain quotes, `<` or `{`. Never
  put Go brace syntax in prose outside backticks. Inside `{[...]}` JS expressions,
  escape `"` as `\"`.
- Run before committing: `pnpm lint-mdx && pnpm validate && pnpm verify:snippets`
  (0 failures). Then render check: start `pnpm dev -p <your port>` and `curl` each
  of your chapter URLs, expecting 200. The URL is the manifest `href`.
- Mark Linux-only or intentionally non-compiling fences as ` ```go noverify `.
- Keep the Lab working: a `self-check` lab's starter must NOT print its `expect`
  sentinel, and the intended fix must print it. Test both with `go run`.
