# Layer 3 — Structure & Links Audit

**Method:** swept all 87 chapters for CodeWalk line-ref accuracy, chapter
cross-reference integrity, manifest/frontmatter validity, and the render gate.

## CodeWalk line-refs (79 walks) — 1 problem

Parsed every `lines:` ref in all 79 `<CodeWalk>` and compared to the wrapped block
length (overshoot / sole-blank).

| Chapter | Walk | Problem |
|---|---|---|
| `appendix/14-mistakes-data-slices-maps.mdx` | "The clobber, line by line" | last step ref reaches **line 27, block is 25 lines** (overshoot by 2) |

Fix: clamp the final step's upper bound to the real last line (the lower lines still
highlight, so the visual mostly works — just sloppy). All 78 other walks are clean
(0 overshoot, 0 sole-blank), including the 18 walks added this session.

## Chapter cross-references — clean

26 in-prose chapter references (the `**Title** (Part N)` / `**Title** chapter`
convention) extracted and resolved against `_manifest.json` titles. **0 dangling** —
every referenced chapter exists. The Part-3 renumber (resilience→14, capstone→15) and
the two new security chapters did not orphan any reference.

## Manifest / frontmatter — clean

`node scripts/validate-content.mjs` → *"Manifest and authored content are structurally
valid."* All 87 entries: path/order/href/slug and frontmatter (part/order/type/title)
match the manifest. No duplicate slugs or part/order collisions.

## Render gate — clean

`pnpm build` → **92/92 static pages prerendered**, compiled successfully. This is the
gate `lint-mdx` cannot provide (lint only compiles MDX; it does not render, so it misses
the wrong-prop class such as `BeforeAfter` `bad`/`good` vs object props). All chapters
render without a static-export crash.

## Verdict

Structure is **clean** — one trivial CodeWalk overshoot is the only finding. Manifest,
cross-references, and full render all pass.
