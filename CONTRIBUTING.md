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
# 1. Typecheck TypeScript
pnpm typecheck

# 2. Validate manifest structure & prerequisites
pnpm validate

# 3. Verify MDX syntax across all chapters
pnpm lint-mdx

# 4. Run full production build
pnpm build
```

## Authoring Guidelines

All course chapters must adhere to the standards outlined in [`content/_AUTHORING_CONTRACT.md`](content/_AUTHORING_CONTRACT.md):

- **Depth**: Ground every explanation in physical machine reality (memory layouts, CPU cache lines, scheduler run queues, system calls).
- **Concrete Scenarios**: Use real-world engineering scenarios (e.g. Meridian fintech backend, banking ledgers, Kafka streaming). Never use `foo`/`bar` filler.
- **Visuals**: Pair complex algorithms and state transitions with an interactive animation component (`AlgoGrid`, `LinkedListAnim`, `TreeAnim`, `GraphAnim`, `DPTableAnim`, `OutboxAnim`, `SagaAnim`, etc.).
- **Typography & Tone**: Clean typography with zero unicode emojis in prose and headers. Code snippets must be `gofmt`-clean and runnable.
- **Labs & Self-Checks**: End each chapter with an interactive `<Lab>` providing a self-check verification harness.
