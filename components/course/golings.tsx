"use client";

import { createElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { Gopher } from "@/components/course/Gopher";
import { GOLINGS, type GolingExercise } from "@/components/course/golings-data";

/* ════════════════════════════════════════════
   Golings — a rustlings-style track for Go, in
   the browser. An ordered set of tiny BROKEN
   programs; you fix each one IN THE PAGE and Run
   it. Codapi executes the real Go on its sandbox
   and emits a `result` event ({ok, stdout}); an
   exercise PASSES when the build is clean and the
   output contains its `expect` sentinel — real
   pass/fail, not a simulation. Progress is kept
   in localStorage so you resume where you left
   off. The next exercise unlocks once the current
   one passes; a gopher reacts on each win.

   Mirrors the Lab component's codapi result-gating,
   generalized to an ordered, progress-tracked set.
   ════════════════════════════════════════════ */
const STORAGE_KEY = "golings.passed.v1";

function loadPassed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function savePassed(s: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    /* storage blocked — progress just won't persist */
  }
}

export function Golings({ exercises = GOLINGS }: { exercises?: GolingExercise[] }) {
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [ran, setRan] = useState(false);
  const [justPassed, setJustPassed] = useState(false);
  const snippetRef = useRef<HTMLElement | null>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const ex = exercises[idx];
  const codeId = `golings-${rawId}-${ex.id}`;
  const isPassed = passed.has(ex.id);
  const doneCount = useMemo(
    () => exercises.filter((e) => passed.has(e.id)).length,
    [exercises, passed]
  );
  const allDone = doneCount === exercises.length;

  // Hydrate progress + jump to the first unsolved exercise on mount.
  useEffect(() => {
    const p = loadPassed();
    setPassed(p);
    const first = exercises.findIndex((e) => !p.has(e.id));
    setIdx(first === -1 ? exercises.length - 1 : first);
  }, [exercises]);

  // Reset per-exercise UI when the exercise changes.
  useEffect(() => {
    setHintOpen(false);
    setRan(false);
    setJustPassed(false);
  }, [idx]);

  // Watch real Codapi runs for THIS exercise. Pass = clean build whose stdout
  // contains the exercise's expect sentinel.
  useEffect(() => {
    const host = snippetRef.current;
    if (!host) return;
    const onResult = (e: Event) => {
      const d = (e as CustomEvent).detail as { ok?: boolean; stdout?: string } | undefined;
      setRan(true);
      if (!d?.ok) return;
      if ((d.stdout ?? "").includes(ex.expect)) {
        setPassed((prev) => {
          if (prev.has(ex.id)) return prev;
          const next = new Set(prev);
          next.add(ex.id);
          savePassed(next);
          return next;
        });
        setJustPassed(true);
      }
    };
    host.addEventListener("result", onResult as EventListener);
    return () => host.removeEventListener("result", onResult as EventListener);
  }, [ex.id, ex.expect]);

  const go = (n: number) => {
    if (n < 0 || n >= exercises.length) return;
    setIdx(n);
  };

  const resetAll = () => {
    setPassed(new Set());
    savePassed(new Set());
    setIdx(0);
  };

  return (
    <section className="gol">
      <div className="gol-head">
        <span className="gol-kicker">⌁ Golings — fix-it track</span>
        <span className="gol-progresscount">
          {doneCount}/{exercises.length} solved
        </span>
      </div>

      {/* progress dots */}
      <div className="gol-dots" role="tablist" aria-label="exercises">
        {exercises.map((e, i) => {
          const state = passed.has(e.id) ? "done" : i === idx ? "cur" : "todo";
          return (
            <button
              key={e.id}
              role="tab"
              aria-selected={i === idx}
              className={`gol-dot gol-dot-${state}`}
              title={`${i + 1}. ${e.title}${passed.has(e.id) ? " ✓" : ""}`}
              onClick={() => go(i)}
            >
              {passed.has(e.id) ? "✓" : i + 1}
            </button>
          );
        })}
      </div>

      <div className="gol-body">
        <div className="gol-exhead">
          <span className="gol-extopic">{ex.topic}</span>
          <span className="gol-extitle">
            {idx + 1}. {ex.title}
          </span>
          {isPassed && <span className="gol-solved">✓ solved</span>}
        </div>

        <p className="gol-instr">
          Make it compile and print <code>{ex.expect}</code>. Edit the code, then press{" "}
          <strong>Run</strong> — it runs on the real Go sandbox.
        </p>

        {/* editable + runnable Codapi snippet, re-keyed per exercise */}
        <div className="gol-editor" key={ex.id}>
          <div className="gol-editor-bar">
            <span>{ex.id}.go</span>
            <span className="gol-editor-tag">editable · runs real Go</span>
          </div>
          <pre className="gol-code" id={codeId} spellCheck={false}>
            <code>{ex.code}</code>
          </pre>
          <div className="gol-snippet">
            {createElement("codapi-snippet", {
              ref: snippetRef,
              sandbox: "go",
              editor: "basic",
              selector: `#${codeId}`,
            })}
          </div>
        </div>

        {/* feedback */}
        {justPassed && (
          <div className="gol-fb gol-fb-ok">
            <span className="gol-fb-gopher" aria-hidden>
              <Gopher pose="happy" state="ok" size={36} role="scientist" title="passed" />
            </span>
            <span className="gol-fb-text">
              <strong>Passed.</strong> {ex.explain}
            </span>
          </div>
        )}
        {ran && !isPassed && !justPassed && (
          <div className="gol-fb gol-fb-no">
            <span className="gol-fb-gopher" aria-hidden>
              <Gopher pose="blocked" state="warn" size={32} role="scientist" title="not yet" />
            </span>
            <span className="gol-fb-text">
              <strong>Not yet.</strong> The output didn&apos;t include <code>{ex.expect}</code>.
              Try the hint, fix the code, and Run again.
            </span>
          </div>
        )}

        {/* hint */}
        <div className="gol-tools">
          <button className="gol-hintbtn" onClick={() => setHintOpen((v) => !v)}>
            {hintOpen ? "Hide hint" : "Show hint"}
          </button>
          {hintOpen && <p className="gol-hint">{ex.hint}</p>}
        </div>

        {/* nav */}
        <div className="gol-nav">
          <button className="gol-navbtn" disabled={idx === 0} onClick={() => go(idx - 1)}>
            ← Prev
          </button>
          <button
            className={`gol-navbtn ${isPassed ? "gol-navbtn-ready" : ""}`}
            disabled={idx === exercises.length - 1}
            onClick={() => go(idx + 1)}
            title={isPassed ? "Next exercise" : "You can move on, but this one isn't solved yet"}
          >
            Next →
          </button>
        </div>
      </div>

      {allDone && (
        <div className="gol-complete">
          <span className="gol-complete-gopher" aria-hidden>
            <Gopher pose="wave" state="done" size={42} role="captain" title="all solved" />
          </span>
          <span className="gol-complete-text">
            <strong>Track complete — all {exercises.length} solved.</strong> You fixed a real Go
            program for every core concept. Keep these reflexes; they&apos;re the muscle the rest of
            the Bible builds on.
          </span>
        </div>
      )}

      <div className="gol-foot">
        <button className="gol-reset" onClick={resetAll}>
          Reset progress
        </button>
        <span className="gol-foot-note">Progress is saved in your browser.</span>
      </div>
    </section>
  );
}
