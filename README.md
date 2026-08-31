<p align="center">
  <img src="app/icon.svg" width="128" height="128" alt="The Go Bible">
</p>

<h1 align="center">The Go Bible</h1>

<p align="center">
  <b>The definitive, visualization-first encyclopedia and course for mastering Go.</b><br>
  From language fundamentals to high-concurrency systems, distributed financial engines, eBPF kernel probes, and cloud-native operators.
</p>

<p align="center">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="MDX" src="https://img.shields.io/badge/MDX-content-FCB32C?logo=mdx&logoColor=black">
  <img alt="Chapters" src="https://img.shields.io/badge/chapters-113%20flagship-f5b13d">
  <img alt="Visuals" src="https://img.shields.io/badge/visual--engine-interactive-10B981">
</p>

---

## 📖 What This Is

**The Go Bible** is an interactive, visualization-heavy Go course and encyclopedia built with Next.js 15, React 19, and MDX. Every single chapter is designed from physical machine reality: seeing the mechanism execute before writing code.

The running domain throughout the book is **Meridian Trust & Clearing**, a realistic high-throughput fintech infrastructure handling racing payments, double-entry ledgers, Kafka outbox relays, and distributed consensus — eliminating `foo`/`bar` fluff.

- **113 Flagship Chapters** across 4 comprehensive tracks.
- **Interactive Visual Engines** — Step through algorithms, memory layouts, GMP scheduler run queues, and distributed sagas in real time.
- **Runnable Sandboxes** — In-browser Go code execution via Codapi with execution trace breakdowns and instant resets.
- **Gamified Learning** — 50 XP player levels, daily streaks, 20 achievement badges, and retro Web Audio sound effects.
- **Production Architectures** — Modeled directly after battle-tested systems like **OpenChoreo**, **The Openlane**, and **Gitea**.

---

## 🗺️ The 4 Flagship Tracks (113 Chapters)

| Track | Focus | Topics & Systems | Chapters |
| :--- | :--- | :--- | :---: |
| **Part 1: The Go Language** | Zero to Production Backend | Fundamentals, Value/Pointer Semantics, CSP Concurrency, Generics, Testing/TDD, REST APIs, SQL Databases, Redis, Microservices, Docker, Standalone Binaries, CI/CD | **28** |
| **Part 2: Production-Grade Engineering** | High-Scale Systems Architecture | GMP Runtime Scheduler, Advanced Concurrency, Memory Profiling & pprof, Tracing & OpenTelemetry, Reliability Patterns, River Background Jobs, Sharding, LSM Storage Engines, Raft Consensus | **24** |
| **Part 3: Fintech & Mission-Critical Systems** | Distributed Financial Capstone | Exact Monetary Math, Double-Entry Ledgers, ACID Isolation, Transactional Outbox, In-Process Event Buses, Distributed Sagas, Kafka Event Streaming, Watermill, Stripe Webhooks, ISO 20022 | **15** |
| **Appendix: Master Systems & Interview Prep** | Specialized Deep Dives & DS&A | DS&A & Top 75 LeetCode in Go, Top 100 Go Production Mistakes, OWASP & Web Exploitation, eBPF & Kernel Observability, Monotonic Fencing Locks, Zero-Alloc Ring Buffers, Wasm/WASI Plugins, Kubernetes Operators, ReBAC/OpenFGA, Ent Graph ORM, Embedded SSH Servers | **46** |

---

## 🕹️ Interactive Visual Engine

The platform features tailored, stepped animation components built in pure React + SVG:

| Engine Component | Mechanism Visualized |
| :--- | :--- |
| **`AlgoGrid`** | Binary search cutting interval search space in half with `lo`, `mid`, `hi` mascot pointers |
| **`LinkedListAnim`** | Heap node chains, 3-pointer list reversal, and Floyd's Tortoise & Hare cycle detection |
| **`TreeAnim`** | Binary trees, BST search paths, and `maxDepth` recursive bottom-up combination |
| **`GraphAnim`** | Level-by-level BFS queue expansion, DFS traversal, and Dijkstra edge relaxation |
| **`SlidingWindowAnim`** | Variable and fixed sliding windows with `L` and `R` pointers tracking subarray sums |
| **`DPTableAnim`** | 1D & 2D memoization grids, cell dependencies, and recurrence formula lookups |
| **`StackHeapAnim`** | Stack frame allocations, value copies, ghost writes, and heap escape analysis |
| **`SliceAnim`** | Slice header (`ptr`, `len`, `cap`), in-place appends, and capacity reallocation growth |
| **`MapAnim`** | 8-element bucket slots, hash calculation, collision chaining, and load factor expansion |
| **`ChannelAnim`** | Goroutines sending/receiving into `hchan` ring buffers, blocking, and waking |
| **`SchedulerAnim`** | Go GMP M:N runtime scheduler, processor run queues, and work-stealing loops |
| **`GCAnim`** | Tricolor mark-and-sweep garbage collection, root scanning, and write barriers |
| **`OutboxAnim`** | Transactional Outbox ACID database commit + CDC relay stream to Kafka brokers |
| **`SagaAnim`** | Distributed Saga orchestrator with forward executions and reverse compensating rollbacks |
| **`RateLimitAnim`** | Token Bucket, Leaky Bucket, and Sliding Window traffic shaping and 429 shedding |
| **`LocksmithAnim`** | Distributed locking with Redis/etcd leases and monotonic fencing token verification |

---

## 💻 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Static Site Generation) + [React 19](https://react.dev/)
- **Content Engine**: MDX via `next-mdx-remote/rsc` with [Shiki](https://shiki.style/) syntax highlighting
- **Sandbox Runner**: [Codapi](https://codapi.org/) in-browser Go runtime
- **Audio Engine**: Pure Web Audio API synthesized 8-bit retro sound generator (zero audio file assets)
- **Styling**: Modern Beautiful UI design system with responsive sidebar, reading progress tracking, and bookmark management

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm

```bash
# Clone the repository
git clone https://github.com/Oyetomi/golang-bible.git
cd golang-bible

# Install dependencies
pnpm install

# Start development server
pnpm dev
# -> http://localhost:3000
```

### Build & Verification Commands

```bash
pnpm build            # Build search index and generate static Next.js pages (118 pages)
pnpm validate         # Validate manifest and all 113 authored chapters
pnpm lint-mdx         # Parse and compile-check all 113 MDX chapter files
pnpm search-index     # Rebuild the 2,100+ entry client search index
```

---

## 📁 Repository Structure

```
golang-bible/
├── content/                 # 113 authored MDX chapters + manifest
│   ├── part-1/              # 28 Chapters: Language & Backend Fundamentals
│   ├── part-2/              # 24 Chapters: Systems Engineering & Reliability
│   ├── part-3/              # 15 Chapters: Fintech Architecture & Ledgers
│   ├── appendix/            # 46 Chapters: DS&A, Kernel, Security & Enterprise
│   ├── _manifest.json       # Source of truth for routes, order & prerequisites
│   └── _AUTHORING_CONTRACT.md
├── app/                     # Next.js App Router (layout, pages, icon.svg)
├── components/
│   ├── course/              # Animations (anim.tsx), Playgrounds, Labs, Quizzes
│   ├── gamification/        # XP Header, Badges Modal, Gopher Mascot
│   └── nav/                 # Sidebar, Bookmark Manager, Reading Progress
├── lib/                     # Content loaders, sound engine, gamification store
├── scripts/                 # Search index builder, content validator, MDX linter
└── public/                  # Static assets, favicon, generated search index
```

---

<p align="center">
  <sub>Crafted for engineers who want to build high-scale, bulletproof systems in Go.</sub>
</p>
