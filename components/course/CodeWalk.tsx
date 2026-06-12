"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Gopher, type GopherPose, type GopherRole, type GopherState } from "./Gopher";
import { SPEEDS, speedLabel } from "./client";

/* ──────────────────────────────────────────────
   CodeWalk: a gopher walks you through a real,
   Shiki-highlighted code block, line-band by
   line-band. Wrap an existing <GoPlayground>
   (or fenced block) — the SAME code stays
   runnable; CodeWalk just adds the guided tour
   on top by targeting rehype-pretty-code's
   per-line [data-line] spans. No duplication.
   ────────────────────────────────────────────── */

type WalkStep = {
  /** 1-based line(s) to spotlight: "3", "3-5", "3-5,9", or [3,4,5] */
  lines: string | number[];
  note: string;
  pose?: GopherPose;
  role?: GopherRole;
  state?: GopherState;
  beat?: "problem" | "solution" | "neutral";
};

function parseLines(spec: string | number[]): Set<number> {
  if (Array.isArray(spec)) return new Set(spec);
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = +m[1];
    const b = m[2] ? +m[2] : a;
    for (let i = a; i <= b; i++) out.add(i);
  }
  return out;
}

export function CodeWalk({
  title = "Code walkthrough",
  steps,
  caption,
  children,
}: {
  title?: string;
  steps: WalkStep[];
  caption?: string;
  children: ReactNode;
}) {
  const [cur, setCur] = useState(-1); // -1 = untouched code
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setCur((c) => {
        if (c >= steps.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 2600 / speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, steps.length, speed]);

  /* paint the current step onto the real rendered lines */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lines = host.querySelectorAll<HTMLElement>("[data-line]");
    if (cur < 0) {
      lines.forEach((el) => el.classList.remove("cwk-hot", "cwk-dim"));
      return;
    }
    const hot = parseLines(steps[cur].lines);
    const hotEls: HTMLElement[] = [];
    lines.forEach((el, i) => {
      const isHot = hot.has(i + 1);
      el.classList.toggle("cwk-hot", isHot);
      el.classList.toggle("cwk-dim", !isHot);
      if (isHot) hotEls.push(el);
    });
    hotEls[0]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => lines.forEach((el) => el.classList.remove("cwk-hot", "cwk-dim"));
  }, [cur, steps]);

  const now = cur >= 0 ? steps[cur] : null;
  const beat = now?.beat ?? "neutral";

  return (
    <div className="cwk" ref={hostRef}>
      <div className="cwk-head">
        <span className="cwk-kicker">code walk</span>
        <span className="cwk-title">{title}</span>
        <div className="cwk-ctrls">
          <button
            className="cwk-btn"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}
            aria-label="Playback speed"
            title="Playback speed"
          >
            {speedLabel(speed)}
          </button>
          <button
            className="cwk-btn"
            onClick={() => {
              setPlaying(false);
              setCur(-1);
            }}
            aria-label="Reset"
          >
            ⤺
          </button>
          <button
            className="cwk-btn"
            onClick={() => {
              setPlaying(false);
              setCur((c) => Math.min(c + 1, steps.length - 1));
            }}
            aria-label="Step forward"
          >
            ⏭
          </button>
          <button
            className="cwk-btn cwk-play"
            onClick={() => {
              if (cur >= steps.length - 1) setCur(-1);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "❚❚ Pause" : "▶ Walk me through it"}
          </button>
        </div>
      </div>

      <div className="cwk-body">{children}</div>

      <div className={`cwk-note cwk-beat-${beat}`}>
        <span className="cwk-gopher">
          <Gopher
            pose={now?.pose ?? (cur < 0 ? "wave" : "run")}
            state={now?.state ?? (cur < 0 ? "idle" : "active")}
            role={now?.role}
            size={44}
          />
        </span>
        {now ? (
          <span className="cwk-text">
            <span className="cwk-stepno">
              {cur + 1}/{steps.length}
            </span>
            {now.note}
          </span>
        ) : (
          <span className="cwk-text cwk-idle">
            Press <strong>▶ Walk me through it</strong> — I&rsquo;ll light up each piece of
            this code and tell you what it&rsquo;s really doing. Then run it yourself.
          </span>
        )}
      </div>

      <div className="cwk-dots">
        {steps.map((_, i) => (
          <button
            key={i}
            className={`cwk-dot ${i === cur ? "on" : ""} ${i < cur ? "past" : ""}`}
            onClick={() => {
              setPlaying(false);
              setCur(i);
            }}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>

      {caption && <div className="cwk-cap">{caption}</div>}
    </div>
  );
}
