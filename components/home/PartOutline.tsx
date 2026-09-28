"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile, type PlayerProfile } from "@/lib/gamification";

export type OutlineLesson = {
  slug: string;
  title: string;
  href: string;
  order: number;
  type: "course" | "project";
  kind?: "lesson" | "workshop" | "sidequest";
  module?: string;
  minutes: number;
  checks: string[];
  labs: string[];
};

type Props = {
  label: string; // "Part 1", "Track"
  title: string;
  subtitle: string;
  lessons: OutlineLesson[];
  locking: boolean; // soft-lock lessons after the first unfinished one
  collapsed?: boolean;
};

function solved(l: OutlineLesson, p: PlayerProfile) {
  const qc = new Set(p.solvedQuickChecks);
  const labs = p.solvedLabs;
  let n = 0;
  for (const q of l.checks) if (qc.has(q)) n++;
  for (const t of l.labs) if (labs.some((k) => k === t || k.startsWith(t + ":"))) n++;
  return n;
}

function useProfile() {
  const [p, setP] = useState<PlayerProfile | null>(null);
  useEffect(() => {
    const sync = () => setP(getProfile());
    sync();
    window.addEventListener("gb:gamification", sync);
    return () => window.removeEventListener("gb:gamification", sync);
  }, []);
  return p;
}

/* A part or track as a course outline: a progress bar, then numbered modules
   of lessons, each with its state, its challenges solved, and its reading
   time. Locks are soft: a lesson after the first unfinished one looks locked
   and says so, but still opens, because a book should never refuse a page. */
export function PartOutline({ label, title, subtitle, lessons, locking, collapsed }: Props) {
  const profile = useProfile();
  const done = new Set(profile?.completedChapters ?? []);
  const doneCount = lessons.filter((l) => done.has(l.slug)).length;
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const current = lessons.find((l) => !done.has(l.slug))?.slug;
  const currentIdx = lessons.findIndex((l) => l.slug === current);

  // Group into modules in order; parts without modules are one module.
  const modules: { name: string; lessons: OutlineLesson[] }[] = [];
  for (const l of lessons) {
    const name = l.module ?? "All lessons";
    const last = modules[modules.length - 1];
    if (last && last.name === name) last.lessons.push(l);
    else modules.push({ name, lessons: [l] });
  }

  return (
    <section className="po">
      <header className="po-head">
        <p className="po-kicker">{label}</p>
        <h2 className="po-title">{title}</h2>
        <p className="po-sub">{subtitle}.</p>
        <div className="po-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="po-count">
          <strong>{pct}% complete</strong> {doneCount} of {lessons.length} lessons
        </p>
      </header>
      {modules.map((m, mi) => (
        <Module
          key={m.name + mi}
          n={mi + 1}
          name={m.name}
          lessons={m.lessons}
          done={done}
          current={current}
          lockedFrom={locking && currentIdx >= 0 ? currentIdx : Infinity}
          all={lessons}
          profile={profile}
          startOpen={!collapsed}
        />
      ))}
    </section>
  );
}

function Module({
  n, name, lessons, done, current, lockedFrom, all, profile, startOpen,
}: {
  n: number;
  name: string;
  lessons: OutlineLesson[];
  done: Set<string>;
  current?: string;
  lockedFrom: number;
  all: OutlineLesson[];
  profile: PlayerProfile | null;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const finished = lessons.filter((l) => done.has(l.slug)).length;
  const currentTitle = all.find((l) => l.slug === current)?.title;
  return (
    <div className="po-mod">
      <button type="button" className="po-mod-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="po-mod-n">{String(n).padStart(2, "0")}</span>
        <span className="po-mod-name">{name}</span>
        <span className="po-chip">
          {finished}/{lessons.length}
        </span>
        <svg className="po-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ol className="po-list">
          {lessons.map((l) => {
            const idx = all.indexOf(l);
            const isDone = done.has(l.slug);
            const isCurrent = l.slug === current;
            const locked = !isDone && !isCurrent && idx > lockedFrom;
            const total = l.checks.length + l.labs.length;
            const got = profile ? solved(l, profile) : 0;
            const kind = l.kind === "sidequest" ? "Sidequest" : l.kind === "workshop" ? "Workshop" : l.type === "project" ? "Build" : null;
            return (
              <li key={l.slug}>
                <Link
                  href={l.href}
                  className={`po-row ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""} ${locked ? "is-locked" : ""}`}
                  title={locked && currentTitle ? `Suggested: finish "${currentTitle}" first` : undefined}
                >
                  <span className="po-state" aria-hidden="true">
                    {isDone ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                    ) : locked ? (
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                    ) : kind === "Sidequest" ? (
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6-9 9H5v-6z" /><path d="M13 5l6 6" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </span>
                  <span className="po-lesson">
                    <span className="po-lesson-title">{l.title}</span>
                    {kind && <span className={`po-kind po-kind-${kind.toLowerCase()}`}>{kind}</span>}
                  </span>
                  {total > 0 && (
                    <span className={`po-chal ${got === total ? "is-full" : ""}`} title={`${got} of ${total} challenges solved`}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>
                      {got}/{total}
                    </span>
                  )}
                  <span className="po-min">{l.minutes} min</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
