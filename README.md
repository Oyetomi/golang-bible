<p align="center">
  <img src="app/icon.svg" width="112" height="112" alt="The Go Bible">
</p>

<h1 align="center">The Go Bible</h1>

<p align="center">
  A visualization-heavy, Boot.dev-style Go course —
  <br>from syntax, to senior production engineer, to fintech specialist.
</p>

<p align="center">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="MDX" src="https://img.shields.io/badge/MDX-content-FCB32C?logo=mdx&logoColor=black">
  <img alt="Chapters" src="https://img.shields.io/badge/chapters-82-f5b13d">
</p>

---

## What this is

An interactive Go course delivered as a Next.js + MDX site. Every chapter is built around **seeing** the idea before reading it: animated execution timelines, real-world problem scenes, runnable Go playgrounds, exercises with solutions, and a capture-the-flag lab. The running example throughout is **Meridian**, a fictional fintech backend, so concepts land on concrete problems — racing transfers, stale balances, idempotent payments — not `foo`/`bar` filler.

- **82 chapters**, 5 hands-on projects, across 4 tracks
- **Runnable code** — self-contained snippets run in-browser; expand to a full-screen, font-adjustable reader
- **Animated visuals** — `ExecTimeline` for code execution, `Scene` for the problem domain
- **Every chapter** ends with a lab + scoreboard

## The tracks

| Part | Title | Focus | Chapters |
|------|-------|-------|----------|
| **1** | The Language | Zero to Backend | 28 |
| **2** | Becoming a Badass Go Engineer | Production-grade engineering | 23 |
| **3** | Fintech in Go | The domain capstone | 13 |
| **Appendix** | DS&A & Coding Interviews | Optional interview-prep track | 18 |

Part 2 includes a distributed-data arc (replication → sharding → storage engines → distributed-systems failure modes → consistency & consensus). The appendix bundles a DS&A interview track plus a 100-item **Go mistakes** gauntlet.

## Tech stack

- **[Next.js 15](https://nextjs.org/)** (App Router) + **React 19**
- **MDX** via `next-mdx-remote/rsc`, highlighted with **Shiki**
- In-browser Go execution via **Codapi**
- Content read at request time from [`/content`](content) — chapters are plain MDX, no imports; shared course components are auto-injected through [`mdx-components.tsx`](mdx-components.tsx)

## Getting started

```bash
pnpm install          # or npm install
pnpm dev              # http://localhost:3000
```

Other scripts:

```bash
pnpm build            # build search index, then next build
pnpm validate         # check manifest + chapter structure
pnpm lint-mdx         # compile-check every chapter's MDX
pnpm search-index     # rebuild public/search-index.json
```

## Project layout

```
golang-bible/
├── content/                 # 82 chapters (MDX) + _manifest.json
│   ├── part-1/  part-2/  part-3/  appendix/
│   ├── _manifest.json       # ordering, prereqs, routes — source of truth
│   └── _AUTHORING_CONTRACT.md
├── app/                     # Next.js routes (app router) + icon.svg
├── components/course/       # ExecTimeline, Scene, GoPlayground, Lab, …
├── lib/                     # content loader + manifest helpers
├── scripts/                 # build-search-index, validate-content, lint-mdx
└── public/                  # generated search index, static assets
```

## Authoring a chapter

Chapters are MDX files under `content/<part>/`, registered in `content/_manifest.json`. The full house style — persona, the five mandates, required components, MDX safety rules — lives in [`content/_AUTHORING_CONTRACT.md`](content/_AUTHORING_CONTRACT.md). After editing, run `pnpm validate && pnpm lint-mdx`.

---

<p align="center"><sub>Private project. All rights reserved.</sub></p>
