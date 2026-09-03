"use client";

import { useState } from "react";
import { Gopher, type GopherRole } from "@/components/course/Gopher";
import { recordQuickCheck } from "@/lib/gamification";
import { playBuzzer, playClick, playSuccess } from "@/lib/sound";
import { triggerConfetti } from "@/lib/confetti";
import { highlightGo } from "@/lib/highlight";

type PredictLabProps = {
  prompt?: string;
  code: string;
  options: string[];
  answer: number;
  output: string;
  explain: string;
  role?: GopherRole;
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
    window.setTimeout(() => {
      setPhase("revealed");
      if (i === answer) {
        recordQuickCheck(prompt);
        playSuccess();
        triggerConfetti();
      } else {
        playBuzzer();
      }
    }, 600);
  };

  const handleRetry = () => {
    setPicked(null);
    setPhase("predict");
    playClick();
  };

  const correct = picked === answer;

  return (
    <div className="pl">
      <div className="pl-head">
        <span className="pl-tag">Predict &amp; run</span>
        <span className="pl-q">{prompt}</span>
      </div>

      <pre className="pl-code">
        <code dangerouslySetInnerHTML={{ __html: highlightGo(code) }} />
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
              type="button"
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
            <div className="pl-fb-body">
              <span className="pl-fb-text">
                <strong>{correct ? "You called it." : "Not quite."}</strong> {explain}
              </span>
              {!correct && (
                <button className="pl-retry-btn" onClick={handleRetry} type="button">
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
