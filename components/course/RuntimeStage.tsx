"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Gopher, type GopherPose, type GopherRole, type GopherState } from "./Gopher";

/* ════════════════════════════════════════════════════════════════════
   RuntimeStage — a continuous-time stage, not a slideshow.

   The chapter describes a *world* (zones: run queues, CPUs, a channel's
   wait queues, the timer heap…) and a *script* of events on a clock
   ("at 3.6s, main moves to quotes.recvq and parks"). The stage replays
   the script at any time t, so:
     • many actors move AT THE SAME TIME, each on its own arc;
     • queues shuffle forward when the head leaves (positions are derived
       from arrival order, then eased — nothing teleports);
     • the scrubber is continuous: drag time backwards and the whole world
       rewinds, because position is a pure function of t plus easing.

   Positions live in a fixed design space (default 760×452) that is
   scaled to the column width, so the choreography is identical on a
   phone and a desktop.
   ════════════════════════════════════════════════════════════════════ */

export type StageZoneKind = "cpu" | "queue" | "chan" | "wait" | "exit" | "plain";
export type StageZone = {
  id: string;
  label: string;
  sub?: string; // small caption under the label, e.g. "local run queue"
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: StageZoneKind;
};
export type StageActor = {
  id: string;
  label: string; // shown under the gopher / inside the chip
  kind?: "g" | "value";
  role?: GopherRole;
  tag?: string; // chest badge, e.g. "1" for G1
};
export type ActorState = "running" | "runnable" | "parked" | "sleeping" | "done" | "value";
export type StageEvent = {
  at: number; // seconds on the stage clock
  id?: string; // actor to move (omit for a narration-only event)
  to?: string; // zone id ("" = hide the actor)
  state?: ActorState;
  carry?: string | null; // payload box the gopher carries from now on
  note?: string; // narration shown from this moment
  clock?: string; // program-time label, e.g. "t ≈ 50 ms"
  beat?: "problem" | "solution" | "neutral";
  hot?: string[]; // zones to highlight from this moment
};

const MOVE = 0.55; // seconds a move takes on the stage clock
const SPEEDS = [1, 0.5, 2] as const;

type Placed = {
  zone: string;
  state: ActorState;
  carry: string | null;
  since: number; // stage time of the last zone change
  from: string | null; // previous zone
  order: number; // arrival stamp inside the zone
};

/* Replay the script up to time t: where is everyone, in what state? */
function worldAt(events: StageEvent[], actors: StageActor[], t: number) {
  const placed = new Map<string, Placed>();
  let note = "";
  let clock = "";
  let beat: StageEvent["beat"] = "neutral";
  let hot: string[] = [];
  let stamp = 0;
  for (const e of events) {
    if (e.at > t) break;
    if (e.note !== undefined) {
      note = e.note;
      beat = e.beat ?? "neutral";
    }
    if (e.clock !== undefined) clock = e.clock;
    if (e.hot !== undefined) hot = e.hot;
    if (!e.id) continue;
    const prev = placed.get(e.id);
    const actor = actors.find((a) => a.id === e.id);
    const moved = e.to !== undefined && e.to !== prev?.zone;
    placed.set(e.id, {
      zone: e.to ?? prev?.zone ?? "",
      state: e.state ?? prev?.state ?? (actor?.kind === "value" ? "value" : "runnable"),
      carry: e.carry !== undefined ? e.carry : prev?.carry ?? null,
      since: moved ? e.at : prev?.since ?? e.at,
      from: moved ? prev?.zone ?? null : prev?.from ?? null,
      order: moved ? ++stamp : prev?.order ?? ++stamp,
    });
  }
  return { placed, note, clock, beat, hot };
}

/* Slot position of the i-th of n actors inside a zone (design space).
   Actors stand on a lane near the zone's bottom edge, below its label. */
function slot(z: StageZone, i: number, n: number, kind: "g" | "value") {
  const step = kind === "value" ? 96 : 82;
  const cx = z.x + z.w / 2;
  const lane = z.y + z.h - (kind === "value" ? 30 : 14);
  const cols = Math.max(1, Math.floor((z.w - 12) / step));
  const row = Math.floor(i / cols);
  const col = i % cols;
  const inRow = Math.min(cols, n - row * cols);
  const x0 = cx - ((inRow - 1) * step) / 2;
  return { x: x0 + col * step, y: lane - row * 56 };
}

export function RuntimeStage({
  title,
  kicker = "runtime",
  zones,
  actors,
  events,
  width = 760,
  height = 452,
  caption,
}: {
  title: string;
  kicker?: string;
  zones: StageZone[];
  actors: StageActor[];
  events: StageEvent[];
  width?: number;
  height?: number;
  caption?: string;
}) {
  const sorted = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);
  const end = (sorted[sorted.length - 1]?.at ?? 0) + MOVE + 0.6;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [scale, setScale] = useState(1);
  const [reduced, setReduced] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  // The clock. Stage seconds advance with real time × speed.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setT((cur) => {
        const next = cur + dt;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, end]);

  const w = worldAt(sorted, actors, t);
  const zoneById = new Map(zones.map((z) => [z.id, z]));

  // Group by zone in arrival order, so queues form (and shuffle) naturally.
  const byZone = new Map<string, string[]>();
  for (const [id, p] of w.placed) {
    if (!p.zone) continue;
    const list = byZone.get(p.zone) ?? [];
    list.push(id);
    byZone.set(p.zone, list);
  }
  for (const list of byZone.values()) list.sort((a, b) => w.placed.get(a)!.order - w.placed.get(b)!.order);

  const posOf = (zoneId: string, id: string, list: string[], kind: "g" | "value") => {
    const z = zoneById.get(zoneId);
    if (!z) return null;
    return slot(z, list.indexOf(id), list.length, kind);
  };

  const toggle = () => {
    if (t >= end) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="rst">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          <button
            className="anim-btn"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            aria-label="Playback speed"
            title="Playback speed"
          >
            {speed === 0.5 ? "½×" : `${speed}×`}
          </button>
          <button className="anim-btn" onClick={() => { setPlaying(false); setT(0); }} aria-label="Restart" title="Restart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button className="anim-btn anim-play" onClick={toggle}>
            {playing ? "Pause" : t >= end ? "Replay" : t > 0 ? "Resume" : "Play"}
          </button>
        </div>
      </div>

      <div className="rst-viewport" ref={wrap} style={{ height: height * scale }}>
        <div className="rst-world" style={{ width, height, transform: `scale(${scale})` } as CSSProperties}>
          {zones.map((z) => (
            <div
              key={z.id}
              className={`rst-zone ${z.kind ?? "plain"} ${w.hot.includes(z.id) ? "hot" : ""} ${
                z.kind === "cpu" && (byZone.get(z.id)?.length ?? 0) > 0 ? "busy" : ""
              }`}
              style={{ left: z.x, top: z.y, width: z.w, height: z.h }}
            >
              <span className="rst-zlabel">{z.label}</span>
              {z.sub && <span className="rst-zsub">{z.sub}</span>}
            </div>
          ))}

          {actors.map((a) => {
            const p = w.placed.get(a.id);
            if (!p || !p.zone) return null;
            const kind = a.kind ?? "g";
            const list = byZone.get(p.zone) ?? [a.id];
            const target = posOf(p.zone, a.id, list, kind);
            if (!target) return null;
            // Travel: glide from where it was (slot at departure) along an arc.
            let x = target.x;
            let y = target.y;
            const k = reduced ? 1 : Math.min(1, Math.max(0, (t - p.since) / MOVE));
            if (k < 1 && p.from) {
              const fz = zoneById.get(p.from);
              if (fz) {
                const start = slot(fz, 0, 1, kind);
                const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
                x = start.x + (target.x - start.x) * e;
                y = start.y + (target.y - start.y) * e - Math.sin(Math.PI * k) * 46; // the arc
              }
            }
            const moving = k < 1 && Boolean(p.from);
            if (kind === "value") {
              return (
                <span
                  key={a.id}
                  className={`rst-value ${moving ? "moving" : ""}`}
                  style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
                >
                  {a.label}
                </span>
              );
            }
            const pose: GopherPose = moving
              ? p.carry ? "carry" : "run"
              : p.state === "running" ? (p.carry ? "carry" : "run")
              : p.state === "parked" ? "blocked"
              : p.state === "sleeping" ? "sleep"
              : p.state === "done" ? "happy"
              : "idle";
            const gstate: GopherState =
              p.state === "running" ? "active" : p.state === "parked" ? "warn" : p.state === "done" ? "done" : "idle";
            return (
              <div
                key={a.id}
                className={`rst-actor ${p.state} ${moving ? "moving" : ""}`}
                style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -62%)` }}
              >
                <Gopher pose={pose} state={gstate} size={40} role={a.role} tag={a.tag} payload={p.carry ?? undefined} title={a.label} />
                <span className="rst-alabel">{a.label}</span>
              </div>
            );
          })}

          {w.clock && <span className="rst-clock">{w.clock}</span>}
        </div>
      </div>

      <div className={`anim-note anim-beat-${w.beat ?? "neutral"}`}>
        <span className="anim-frameno">{t.toFixed(1)}s</span>
        <span>{w.note || "Press Play. Everything on this stage moves on one clock, so watch several gophers at once."}</span>
      </div>
      <div className="rst-scrub">
        <input
          type="range"
          min={0}
          max={end}
          step={0.01}
          value={t}
          aria-label="Scrub the timeline"
          onChange={(e) => {
            setPlaying(false);
            setT(Number(e.target.value));
          }}
        />
        <div className="rst-ticks" aria-hidden>
          {sorted.filter((e) => e.note).map((e, i) => (
            <button
              key={i}
              className={`rst-tick ${e.at <= t ? "past" : ""} ${e.beat ?? ""}`}
              style={{ left: `${(e.at / end) * 100}%` }}
              onClick={() => {
                setPlaying(false);
                setT(e.at + MOVE);
              }}
              title={e.note}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>
      {caption && <figcaption className="anim-cap">{caption}</figcaption>}
    </figure>
  );
}
