/* ─────────────────────────────────────────────────────────────
   Stickers and Go eras.

   Levels (1–50, from lib/gamification.ts) are named after Go releases, so
   climbing them retraces how the language grew: the Go 1 promise, the
   self-hosted compiler, modules, generics, iterators, and finally the release
   this book is built on. Each badge is a die-cut sticker; the ids match
   BADGE_DEFINITIONS so existing progress carries over untouched.
   ───────────────────────────────────────────────────────────── */

import type { BadgeId } from "@/lib/gamification";

export interface GoEra {
  minLevel: number;
  release: string; // "Go 1.18"
  year: number;
  name: string; // shown as the reader's title
  note: string; // what that release changed, one sentence
}

/** Highest first, like TITLES_BY_LEVEL. */
export const GO_ERAS: GoEra[] = [
  { minLevel: 50, release: "Go 1.27", year: 2026, name: "Go 1.27 Gopher", note: "The release this book is verified against. You're current." },
  { minLevel: 45, release: "Go 1.23", year: 2024, name: "Iterator Gopher", note: "range-over-func arrived: iter.Seq, and loops over anything that yields." },
  { minLevel: 40, release: "Go 1.22", year: 2024, name: "Loopvar Gopher", note: "Each loop iteration got its own variable, ending a decade-old closure bug." },
  { minLevel: 35, release: "Go 1.21", year: 2023, name: "Slog Gopher", note: "log/slog, min/max/clear, and toolchain management shipped together." },
  { minLevel: 30, release: "Go 1.18", year: 2022, name: "Generics Gopher", note: "Type parameters and native fuzzing: the biggest change since Go 1.0." },
  { minLevel: 25, release: "Go 1.14", year: 2020, name: "Preemption Gopher", note: "Asynchronous preemption: a tight loop can no longer starve the scheduler." },
  { minLevel: 20, release: "Go 1.13", year: 2019, name: "Wrapped-Error Gopher", note: "%w, errors.Is and errors.As gave errors a chain you can inspect." },
  { minLevel: 15, release: "Go 1.11", year: 2018, name: "Modules Gopher", note: "go.mod arrived, and GOPATH stopped being the only way to build." },
  { minLevel: 10, release: "Go 1.7", year: 2016, name: "Context Gopher", note: "context moved into the standard library: cancellation got one shape." },
  { minLevel: 5, release: "Go 1.5", year: 2015, name: "Self-Hosted Gopher", note: "The compiler was rewritten in Go and the GC went concurrent." },
  { minLevel: 1, release: "Go 1.0", year: 2012, name: "Go 1 Gopher", note: "The compatibility promise: code written for Go 1 keeps building." },
];

export function eraForLevel(level: number): GoEra {
  return GO_ERAS.find((e) => level >= e.minLevel) ?? GO_ERAS[GO_ERAS.length - 1];
}

/** The era after this one, or null at the top. */
export function nextEra(level: number): GoEra | null {
  const i = GO_ERAS.findIndex((e) => level >= e.minLevel);
  return i > 0 ? GO_ERAS[i - 1] : null;
}

export type Rarity = "common" | "rare" | "legendary" | "iconic";

export const RARITY: Record<Rarity, { label: string; order: number }> = {
  iconic: { label: "Iconic", order: 0 },
  legendary: { label: "Legendary", order: 1 },
  rare: { label: "Rare", order: 2 },
  common: { label: "Common", order: 3 },
};

export type Motif =
  | "spark" | "bolt" | "cap" | "bug" | "flag" | "pipe" | "checker" | "hexagon"
  | "crown" | "zero" | "chip" | "flask" | "flame" | "rocket" | "moon"
  | "compass" | "book" | "gopher" | "prompt" | "headphones";

export interface Sticker {
  id: BadgeId;
  motif: Motif;
  rarity: Rarity;
  from: string;
  to: string;
  /** How to earn it, shown while locked. */
  hint: string;
  /** A piece of Go history, shown once it's yours. */
  lore: string;
}

export const STICKERS: Record<BadgeId, Sticker> = {
  first_code: {
    id: "first_code", motif: "spark", rarity: "common", from: "#5fd4f0", to: "#0a7fa6",
    hint: "Run any Go snippet in a playground",
    lore: "Go was sketched at Google in September 2007 by Robert Griesemer, Rob Pike and Ken Thompson, and open-sourced on 10 November 2009.",
  },
  playground_hacker: {
    id: "playground_hacker", motif: "prompt", rarity: "rare", from: "#3b4a6b", to: "#121a2e",
    hint: "Run 50 snippets in the sandbox",
    lore: "The Go Playground has run code in a sandbox since 2010. Every snippet here runs the real toolchain too.",
  },
  quick_thinker: {
    id: "quick_thinker", motif: "bolt", rarity: "common", from: "#ffd36b", to: "#e08a00",
    hint: "Answer 5 quick checks correctly",
    lore: "Fast compiles were a founding goal: Go's authors designed it while waiting on 45-minute C++ builds.",
  },
  quiz_master: {
    id: "quiz_master", motif: "cap", rarity: "rare", from: "#8c7bff", to: "#4b33c9",
    hint: "Answer 25 quick checks correctly",
    lore: "gofmt settled style arguments for good: nearly every Go file in the world is laid out the same way.",
  },
  lab_novice: {
    id: "lab_novice", motif: "bug", rarity: "common", from: "#ff8a7a", to: "#d23a4f",
    hint: "Capture your first lab flag",
    lore: "The testing package has shipped since Go 1.0; go test -fuzz joined it in Go 1.18.",
  },
  lab_veteran: {
    id: "lab_veteran", motif: "flag", rarity: "legendary", from: "#ff7ab6", to: "#b3246b",
    hint: "Capture 10 lab flags",
    lore: "Go 1.24 added testing.B.Loop, and Go 1.25 made testing/synctest stable: fake time for concurrent tests.",
  },
  channel_surfer: {
    id: "channel_surfer", motif: "pipe", rarity: "rare", from: "#34d6c4", to: "#0b8a7c",
    hint: "Master channel pipelines and select",
    lore: "Channels come from Tony Hoare's 1978 paper Communicating Sequential Processes. Go shipped them in 1.0.",
  },
  race_slayer: {
    id: "race_slayer", motif: "checker", rarity: "legendary", from: "#ff9f5a", to: "#c2410c",
    hint: "Beat the race conditions in the labs",
    lore: "The race detector arrived with Go 1.1 in 2013, built on Google's ThreadSanitizer.",
  },
  ddd_architect: {
    id: "ddd_architect", motif: "hexagon", rarity: "legendary", from: "#7aa7ff", to: "#2448b8",
    hint: "Design a hexagonal, domain-driven service",
    lore: "Go interfaces are satisfied implicitly, with no implements keyword. That is what keeps ports and adapters so light.",
  },
  consensus_king: {
    id: "consensus_king", motif: "crown", rarity: "legendary", from: "#ffd76b", to: "#b7791f",
    hint: "Master Raft consensus and leases",
    lore: "etcd, the Raft store under every Kubernetes cluster, is written in Go.",
  },
  zero_alloc_titan: {
    id: "zero_alloc_titan", motif: "zero", rarity: "legendary", from: "#6ee7b7", to: "#047857",
    hint: "Build lock-free, zero-copy code",
    lore: "Go 1.5 replaced the stop-the-world collector with a concurrent one aimed at pauses under 10 ms.",
  },
  ebpf_warlock: {
    id: "ebpf_warlock", motif: "chip", rarity: "legendary", from: "#a78bfa", to: "#5b21b6",
    hint: "Attach an eBPF probe from Go",
    lore: "cilium/ebpf loads and attaches eBPF programs from pure Go, with no C toolchain needed at runtime.",
  },
  wasm_alchemist: {
    id: "wasm_alchemist", motif: "flask", rarity: "legendary", from: "#f472b6", to: "#7e22ce",
    hint: "Sandbox untrusted code with WebAssembly",
    lore: "GOOS=js GOARCH=wasm landed in Go 1.11; GOOS=wasip1 followed in Go 1.21.",
  },
  streak_3: {
    id: "streak_3", motif: "flame", rarity: "common", from: "#ffb36b", to: "#e0492f",
    hint: "Learn three days in a row",
    lore: "Go ships a major release every six months, each February and August, like clockwork.",
  },
  streak_7: {
    id: "streak_7", motif: "rocket", rarity: "rare", from: "#60a5fa", to: "#1d4ed8",
    hint: "Learn seven days in a row",
    lore: "The Go 1 compatibility promise (2012) means the code you write this week still builds years from now.",
  },
  night_owl: {
    id: "night_owl", motif: "moon", rarity: "rare", from: "#4c5d8f", to: "#1b2447",
    hint: "Finish a lesson after midnight",
    lore: "Renée French drew the gopher. It first appeared on a WFMU radio promotion before Go adopted it.",
  },
  explorer_10: {
    id: "explorer_10", motif: "compass", rarity: "rare", from: "#4fd1c5", to: "#0e7490",
    hint: "Read 10 full chapters",
    lore: "Modules arrived in Go 1.11 (2018) and became the default in Go 1.16.",
  },
  scholar_50: {
    id: "scholar_50", motif: "book", rarity: "legendary", from: "#38bdf8", to: "#0b4f7c",
    hint: "Read 50 full chapters",
    lore: "Generics took twelve years of proposals before type parameters shipped in Go 1.18, in March 2022.",
  },
  master_100: {
    id: "master_100", motif: "gopher", rarity: "iconic", from: "#5fd4f0", to: "#1b3a6b",
    hint: "Finish the whole Bible",
    lore: "Every chapter, every lab. You now know Go the way the people who build it do.",
  },
  sound_enthusiast: {
    id: "sound_enthusiast", motif: "headphones", rarity: "common", from: "#fda4af", to: "#e11d48",
    hint: "Turn the sound effects on",
    lore: "Go celebrates its birthday every 10 November: the day in 2009 it went open source.",
  },
};
