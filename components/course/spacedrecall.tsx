"use client";

import { useState } from "react";
import { Gopher, type GopherRole } from "@/components/course/Gopher";

/* ════════════════════════════════════════════
   SpacedRecall — the interleaving beat that opens
   a chapter. Before new material, the learner
   retrieves 2–3 facts from EARLIER chapters
   (spacing) and each answer reveals how that old
   idea connects to today's topic (interleaving →
   the "tie"). Storage strength over fluency:
   active recall across a gap, then a bridge into
   the new lesson. A gopher reacts per item and
   warms up once the set is recalled.

   Pure client, no backend (static export safe).
   ════════════════════════════════════════════ */
type RecallItem = {
  from: string; // where it's recalled from, e.g. "Channels (ch11)"
  q: string; // the retrieval question
  options: string[]; // candidate answers
  answer: number; // index of the correct option
  tie: string; // how this old idea connects to TODAY's chapter
};

type SpacedRecallProps = {
  items: RecallItem[];
  role?: GopherRole; // dress the warm-up gopher for today's topic
};

export function SpacedRecall({ items, role = "scientist" }: SpacedRecallProps) {
  const [picks, setPicks] = useState<(number | null)[]>(() => items.map(() => null));

  const pick = (idx: number, choice: number) => {
    if (picks[idx] !== null) return; // lock once answered
    setPicks((p) => p.map((v, i) => (i === idx ? choice : v)));
  };

  const answered = picks.filter((p) => p !== null).length;
  const allDone = answered === items.length;
  const allRight = allDone && items.every((it, i) => picks[i] === it.answer);

  return (
    <div className="sr">
      <div className="sr-head">
        <span className="sr-tag">Before you start · recall</span>
        <span className="sr-sub">
          A few things from earlier chapters — retrieve them cold, then see how each one feeds today.
        </span>
      </div>

      <div className="sr-items">
        {items.map((it, idx) => {
          const picked = picks[idx];
          const revealed = picked !== null;
          const correct = picked === it.answer;
          return (
            <div className="sr-item" key={idx}>
              <div className="sr-item-head">
                <span className="sr-from">{it.from}</span>
                <span className="sr-q">{it.q}</span>
              </div>

              <div className="sr-opts">
                {it.options.map((o, i) => {
                  const state = !revealed
                    ? ""
                    : i === it.answer
                      ? "ok"
                      : i === picked
                        ? "no"
                        : "dim";
                  return (
                    <button
                      key={i}
                      className={`sr-opt ${state}`}
                      disabled={revealed}
                      onClick={() => pick(idx, i)}
                    >
                      <span className="sr-mark">
                        {revealed && i === it.answer
                          ? "✓"
                          : revealed && i === picked
                            ? "✗"
                            : String.fromCharCode(65 + i)}
                      </span>
                      {o}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className={`sr-tie ${correct ? "sr-ok" : "sr-no"}`}>
                  <span className="sr-tie-gopher" aria-hidden>
                    <Gopher
                      pose={correct ? "happy" : "blocked"}
                      state={correct ? "ok" : "warn"}
                      size={28}
                      role={role}
                      title={correct ? "recalled" : "refresher"}
                    />
                  </span>
                  <span className="sr-tie-text">
                    <strong>{correct ? "Recalled." : "Worth a refresher."}</strong> {it.tie}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className={`sr-foot ${allRight ? "sr-foot-ok" : "sr-foot-warm"}`}>
          <span className="sr-foot-gopher" aria-hidden>
            <Gopher
              pose={allRight ? "wave" : "run"}
              state={allRight ? "done" : "active"}
              size={38}
              role={role}
              title="warmed up"
            />
          </span>
          <span className="sr-foot-text">
            {allRight
              ? "Warm. Those foundations carry straight into this chapter — let's build on them."
              : "Good — the gaps you just hit are exactly what this chapter leans on. Keep them in mind as you read."}
          </span>
        </div>
      )}
    </div>
  );
}
