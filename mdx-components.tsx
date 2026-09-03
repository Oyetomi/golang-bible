import * as S from "@/components/course/server";
import * as C from "@/components/course/client";
import * as A from "@/components/course/anim";
import { HackLab } from "@/components/course/hacklab";
import { PredictLab } from "@/components/course/predictlab";
import { SpacedRecall } from "@/components/course/spacedrecall";
import { Golings } from "@/components/course/golings";
import { CodeWalk } from "@/components/course/CodeWalk";
import { ELI5, MentalModel } from "@/components/course/ELI5";
import { ProjectCode } from "@/components/course/ProjectCode";

/* Single source of truth for the components available inside every chapter's
   MDX. Passed to compileMDX in lib/content.ts, so chapter files reference
   <HeroCard>, <ExecTimeline>, etc. directly — no import lines, no drift. */
export const mdxComponents = {
  // Layout / framing
  HeroCard: S.HeroCard,
  ChapterTabs: C.ChapterTabs,
  Recap: S.Recap,
  NextUp: S.NextUp,
  // Code & comparison
  BeforeAfter: S.BeforeAfter,
  GoPlayground: S.GoPlayground,
  ProjectCode,
  // Visual explainers
  ExecTimeline: C.ExecTimeline,
  Scene: C.Scene,
  // Bespoke, chapter-tailored animations (gopher-driven)
  ChannelAnim: A.ChannelAnim,
  SchedulerAnim: A.SchedulerAnim,
  GCAnim: A.GCAnim,
  SliceAnim: A.SliceAnim,
  LockAnim: A.LockAnim,
  LedgerAnim: A.LedgerAnim,
  JourneyAnim: A.JourneyAnim,
  AlgoGrid: A.AlgoGrid,
  MapAnim: A.MapAnim,
  StackHeapAnim: A.StackHeapAnim,
  GraphAnim: A.GraphAnim,
  CacheAnim: A.CacheAnim,
  CircuitAnim: A.CircuitAnim,
  PoolAnim: A.PoolAnim,
  TerminalAnim: A.TerminalAnim,
  HttpAnim: A.HttpAnim,
  SqlAnim: A.SqlAnim,
  OutboxAnim: A.OutboxAnim,
  SagaAnim: A.SagaAnim,
  RateLimitAnim: A.RateLimitAnim,
  ActorAnim: A.ActorAnim,
  LocksmithAnim: A.LocksmithAnim,
  LinkedListAnim: A.LinkedListAnim,
  TreeAnim: A.TreeAnim,
  StackQueueAnim: A.StackQueueAnim,
  SlidingWindowAnim: A.SlidingWindowAnim,
  DPTableAnim: A.DPTableAnim,
  CodeWalk,
  ConceptGrid: S.ConceptGrid,
  ConceptCard: S.ConceptCard,
  Gotcha: S.Gotcha,
  UnderTheHood: S.UnderTheHood,
  Callout: S.Callout,
  Define: S.Define,
  ELI5,
  MentalModel,
  // Practice
  QuickCheck: C.QuickCheck,
  Exercise: S.Exercise,
  Solution: S.Solution,
  // Challenge + progress (placeholder contract → real runner/store on the site)
  Lab: C.Lab,
  HackLab,
  PredictLab,
  SpacedRecall,
  Golings,
  Scoreboard: C.Scoreboard,
};

export type MDXComponentMap = typeof mdxComponents;
