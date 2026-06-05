import * as S from "@/components/course/server";
import * as C from "@/components/course/client";

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
  // Visual explainers
  ExecTimeline: C.ExecTimeline,
  Scene: C.Scene,
  ConceptGrid: S.ConceptGrid,
  ConceptCard: S.ConceptCard,
  Gotcha: S.Gotcha,
  UnderTheHood: S.UnderTheHood,
  Callout: S.Callout,
  Define: S.Define,
  // Practice
  QuickCheck: C.QuickCheck,
  Exercise: S.Exercise,
  Solution: S.Solution,
  // Challenge + progress (placeholder contract → real runner/store on the site)
  Lab: C.Lab,
  Scoreboard: C.Scoreboard,
};

export type MDXComponentMap = typeof mdxComponents;
