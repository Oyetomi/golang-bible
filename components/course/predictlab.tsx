"use client";

import { useState } from "react";
import { Gopher, type GopherRole } from "@/components/course/Gopher";

/* ════════════════════════════════════════════
   PredictLab — the universal interactive beat
   for non-security chapters: predict what a Go
   snippet does, "run" it (a gopher scurries on
   the playground), then the real output reveals
   and a gopher reacts — happy if you called it,
   teaching pose if you didn't. Active recall +
   a payoff, in every chapter.
   ════════════════════════════════════════════ */
type PredictLabProps = {
  prompt?: string; // the question, default "What does this print?"
  code: string; // the snippet to reason about
  options: string[]; // candidate outputs
  answer: number; // index of the correct option
  output: string; // the real stdout revealed on "run"
  explain: string; // the why
  role?: GopherRole; // dress the gopher for the topic
};

type Phase = "predict" | "running" | "revealed";

export function PredictLab({
  prompt = "What does this print?",
  code,
  options,
  answer,
  output,
  explain,
  role = "scientist",
}: PredictLabProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("predict");

  const pick = (i: number) => {
    if (phase !== "predict") return;
    setPicked(i);
    setPhase("running");
    // a beat of "running on the playground" before the reveal
    window.setTimeout(() => setPhase("revealed"), 850);
  };

  const correct = picked === answer;

  return (
    <div className="pl">
      <div className="pl-head">
        <span className="pl-tag">Predict &amp; run</span>
        <span className="pl-q">{prompt}</span>
      </div>

      <pre className="pl-code">
        <code>{code}</code>
      </pre>

      <div className="pl-opts">
        {options.map((o, i) => {
          const state =
            phase !== "revealed"
              ? ""
              : i === answer
                ? "ok"
                : i === picked
                  ? "no"
                  : "dim";
          return (
            <button
              key={i}
              className={`pl-opt ${state} ${picked === i && phase !== "revealed" ? "picked" : ""}`}
              disabled={phase !== "predict"}
              onClick={() => pick(i)}
            >
              <span className="pl-mark">
                {phase === "revealed" && i === answer
                  ? "✓"
                  : phase === "revealed" && i === picked
                    ? "✗"
                    : String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          );
        })}
      </div>

      {phase === "running" && (
        <div className="pl-running">
          <span className="pl-run-gopher" aria-hidden>
            <Gopher pose="run" state="active" size={34} role={role} title="running" />
          </span>
          <span className="pl-run-text">running on the playground…</span>
        </div>
      )}

      {phase === "revealed" && (
        <div className="pl-reveal">
          <div className="pl-term" role="img" aria-label="program output">
            <div className="pl-term-bar">
              <span className="pl-dot pl-dot-r" />
              <span className="pl-dot pl-dot-y" />
              <span className="pl-dot pl-dot-g" />
              <span className="pl-term-title">output</span>
            </div>
            <pre className="pl-term-body">{output}</pre>
          </div>
          <div className={`pl-fb ${correct ? "pl-ok" : "pl-no"}`}>
            <span className="pl-fb-gopher" aria-hidden>
              <Gopher
                pose={correct ? "happy" : "blocked"}
                state={correct ? "ok" : "warn"}
                size={40}
                role={role}
                title={correct ? "called it" : "not quite"}
              />
            </span>
            <span className="pl-fb-text">
              <strong>{correct ? "You called it." : "Not quite."}</strong> {explain}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
