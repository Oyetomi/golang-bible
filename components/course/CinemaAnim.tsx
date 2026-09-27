"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Gopher, type GopherPose, type GopherRole, type GopherState } from "./Gopher";

/* ════════════════════════════════════════════════════════════════════
   CinemaAnim — the booking chapter's world, drawn as a cinema.

   One or more auditoriums (halls) with a curved screen and a real seat
   grid; a lobby where gopher customers wait; a payment desk. A script of
   timed events moves customers to seats, changes seat states (held with a
   draining countdown ring, booked, a red "sold twice" clash), puts speech
   bubbles over customers and banners over halls ("fatal error: …").

   Several halls side by side model replicas: each is that replica's own
   idea of the seat map. The same clock / scrubber model as RuntimeStage:
   the world at time t is a pure function of the script, so it rewinds.
   ════════════════════════════════════════════════════════════════════ */

export type CinemaSeatState = "free" | "held" | "booked" | "clash";

export type CinemaCustomer = { id: string; label: string; role?: GopherRole; look?: "pink" };

export type CinemaHall = { label: string; sub?: string };

export type CinemaEvent = {
  at: number;
  note?: string;
  beat?: "problem" | "solution" | "neutral";
  clock?: string;
  /* move a customer: "lobby", "pay", "" (leave), or a seat "A7" / "A7@1" (hall 1) */
  who?: string;
  to?: string;
  say?: string | null; // speech bubble over the customer (null clears)
  mood?: "ok" | "bad" | "wait"; // tints the customer
  /* change a seat */
  seat?: string; // "A7" or "A7@1"
  state?: CinemaSeatState;
  by?: string; // shown as the holder's initial, in the seat's tooltip
  ttl?: number; // stage seconds a hold lasts: draws a draining ring
  /* hall banner */
  hall?: number;
  banner?: string | null;
};

const MOVE = 0.6;
const SPEEDS = [1, 0.5, 2] as const;
const W = 760;

type Seat = { state: CinemaSeatState; by?: string; since: number; ttl?: number };
type Cust = { to: string; from: string | null; since: number; say: string | null; mood?: string; order: number };

function parseSeat(s: string): { id: string; hall: number } {
  const [id, h] = s.split("@");
  return { id, hall: h ? Number(h) : 0 };
}

function worldAt(events: CinemaEvent[], t: number) {
  const seats = new Map<string, Seat>();
  const cust = new Map<string, Cust>();
  const banners = new Map<number, string>();
  let note = "";
  let beat: CinemaEvent["beat"] = "neutral";
  let clock = "";
  let stamp = 0;
  for (const e of events) {
    if (e.at > t) break;
    if (e.note !== undefined) {
      note = e.note;
      beat = e.beat ?? "neutral";
    }
    if (e.clock !== undefined) clock = e.clock;
    if (e.seat) {
      const { id, hall } = parseSeat(e.seat);
      seats.set(`${hall}:${id}`, { state: e.state ?? "held", by: e.by, since: e.at, ttl: e.ttl });
    }
    if (e.hall !== undefined && e.banner !== undefined) {
      if (e.banner === null) banners.delete(e.hall);
      else banners.set(e.hall, e.banner);
    }
    if (e.who) {
      const prev = cust.get(e.who);
      const to = e.to ?? prev?.to ?? "lobby";
      const moved = to !== prev?.to;
      cust.set(e.who, {
        to,
        from: moved ? prev?.to ?? null : prev?.from ?? null,
        since: moved ? e.at : prev?.since ?? e.at,
        say: e.say !== undefined ? e.say : prev?.say ?? null,
        mood: e.mood ?? prev?.mood,
        order: moved ? ++stamp : prev?.order ?? ++stamp,
      });
    }
  }
  return { seats, cust, banners, note, beat, clock };
}

export function CinemaAnim({
  title,
  kicker = "cinema · live",
  halls = [{ label: "Screen 1" }],
  rows = 5,
  cols = 8,
  customers,
  events,
  noDesk = false,
  caption,
}: {
  title: string;
  kicker?: string;
  halls?: CinemaHall[];
  rows?: number;
  cols?: number;
  customers: CinemaCustomer[];
  events: CinemaEvent[];
  noDesk?: boolean; // hide the payment desk
  caption?: string;
}) {
  const pay = !noDesk;
  const sorted = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);
  const end = (sorted[sorted.length - 1]?.at ?? 0) + MOVE + 0.8;
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
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // ── layout (design space W × H) ─────────────────────────────────────
  const n = halls.length;
  const gap = 14;
  const hallW = (W - 32 - gap * (n - 1)) / n;
  const seatStep = Math.min(40, (hallW - 28) / cols);
  const seatSize = seatStep - 5;
  const gridW = seatStep * cols;
  const hallTop = 16;
  const screenH = 46;
  const hallH = screenH + rows * seatStep + 34;
  const lobbyTop = hallTop + hallH + 16;
  const lobbyH = 118;
  const H = lobbyTop + lobbyH + 14;
  const payW = pay ? 210 : 0;
  const lobbyW = W - 32 - (pay ? payW + gap : 0);

  const hallX = (h: number) => 16 + h * (hallW + gap);
  const seatXY = (id: string, hall: number) => {
    const row = id.charCodeAt(0) - 65;
    const col = Number(id.slice(1)) - 1;
    const gx = hallX(hall) + (hallW - gridW) / 2;
    const gy = hallTop + screenH + 16;
    return { x: gx + col * seatStep + seatStep / 2, y: gy + row * seatStep + seatStep / 2 };
  };

  const w = worldAt(sorted, t);
  const gSize = n > 1 ? 30 : 36;

  // Where a customer stands: lobby / pay slots by arrival order, or on a seat.
  const lobbyList = [...w.cust.entries()].filter(([, c]) => c.to === "lobby").sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
  const payList = [...w.cust.entries()].filter(([, c]) => c.to === "pay").sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
  const spotOf = (where: string | null, id: string): { x: number; y: number } | null => {
    if (!where) return null;
    if (where === "lobby") {
      const i = Math.max(0, lobbyList.indexOf(id));
      const step = Math.min(78, (lobbyW - 40) / Math.max(1, lobbyList.length));
      return { x: 16 + 30 + i * step + step / 2, y: lobbyTop + lobbyH - 30 };
    }
    if (where === "pay") {
      const i = Math.max(0, payList.indexOf(id));
      return { x: W - 16 - payW + 40 + i * 64, y: lobbyTop + lobbyH - 30 };
    }
    if (where === "") return null;
    const { id: seat, hall } = parseSeat(where);
    const p = seatXY(seat, hall);
    // Several customers at one seat crowd round it instead of stacking.
    const here = [...w.cust.entries()].filter(([, c]) => c.to === where).sort((a, b) => a[1].order - b[1].order).map(([cid]) => cid);
    const i = Math.max(0, here.indexOf(id));
    return { x: p.x + (i - (here.length - 1) / 2) * (gSize * 0.62), y: p.y - 6 };
  };

  const toggle = () => {
    if (t >= end) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="rst cin">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          <button className="anim-btn" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed" title="Playback speed">
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

      <div className="rst-viewport cin-viewport" ref={wrap} style={{ height: H * scale }}>
        <div className="rst-world" style={{ width: W, height: H, transform: `scale(${scale})` } as CSSProperties}>
          {halls.map((h, hi) => {
            const x = hallX(hi);
            const banner = w.banners.get(hi);
            return (
              <div key={hi} className={`cin-hall ${banner ? "alarm" : ""}`} style={{ left: x, top: hallTop, width: hallW, height: hallH }}>
                <svg className="cin-screen" width={hallW} height={screenH} viewBox={`0 0 ${hallW} ${screenH}`} aria-hidden>
                  <path d={`M ${hallW * 0.12} 30 Q ${hallW / 2} 8 ${hallW * 0.88} 30`} fill="none" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <span className="cin-hlabel">{h.label}</span>
                {h.sub && <span className="cin-hsub">{h.sub}</span>}
                {banner && <span className="cin-banner">{banner}</span>}
              </div>
            );
          })}

          {halls.flatMap((_, hi) =>
            Array.from({ length: rows * cols }, (_, k) => {
              const id = `${String.fromCharCode(65 + Math.floor(k / cols))}${(k % cols) + 1}`;
              const s = w.seats.get(`${hi}:${id}`);
              const state = s?.state ?? "free";
              const { x, y } = seatXY(id, hi);
              let ring: CSSProperties = {};
              let expired = false;
              if (s && state === "held" && s.ttl) {
                const left = Math.max(0, 1 - (t - s.since) / s.ttl);
                expired = left === 0;
                ring = { "--left": `${left * 360}deg` } as CSSProperties;
              }
              const shown = expired ? "free" : state;
              return (
                <div
                  key={`${hi}:${id}`}
                  className={`cin-seat ${shown} ${s?.ttl && !expired && state === "held" ? "timed" : ""}`}
                  style={{ left: x - seatSize / 2, top: y - seatSize / 2, width: seatSize, height: seatSize, ...ring }}
                  title={s?.by ? `${id}: ${shown} by ${s.by}` : `${id}: free`}
                >
                  <span className="cin-seat-id">{shown !== "free" && s?.by ? s.by[0].toUpperCase() : id}</span>
                  {shown === "clash" && <span className="cin-clash">×{s?.by?.split(",").length ?? 2}</span>}
                </div>
              );
            }),
          )}

          <div className="cin-lobby" style={{ left: 16, top: lobbyTop, width: lobbyW, height: lobbyH }}>
            <span className="cin-hlabel">lobby</span>
          </div>
          {pay && (
            <div className="cin-pay" style={{ left: W - 16 - payW, top: lobbyTop, width: payW, height: lobbyH }}>
              <span className="cin-hlabel">payment desk</span>
              <svg className="cin-card" width="34" height="24" viewBox="0 0 34 24" aria-hidden>
                <rect x="1" y="1" width="32" height="22" rx="4" />
                <rect x="1" y="6" width="32" height="4" className="stripe" />
              </svg>
            </div>
          )}

          {customers.map((c) => {
            const p = w.cust.get(c.id);
            if (!p) return null;
            const target = spotOf(p.to, c.id);
            if (!target) return null;
            let { x, y } = target;
            const k = reduced ? 1 : Math.min(1, Math.max(0, (t - p.since) / MOVE));
            const start = k < 1 ? spotOf(p.from, c.id) : null;
            if (start) {
              const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
              x = start.x + (target.x - start.x) * e;
              y = start.y + (target.y - start.y) * e - Math.sin(Math.PI * k) * 40;
            }
            const moving = Boolean(start);
            const seated = p.to !== "lobby" && p.to !== "pay";
            const pose: GopherPose = moving ? "run" : p.mood === "bad" ? "panic" : p.mood === "ok" ? "happy" : p.mood === "wait" ? "blocked" : seated ? "happy" : "idle";
            // Mood shows in the pose and the bubble; fur colour stays the customer's own.
            const gstate: GopherState = p.mood === "ok" ? "done" : p.mood === "wait" ? "warn" : seated ? "active" : "idle";
            return (
              <div
                key={c.id}
                className={`cin-cust ${moving ? "moving" : ""} ${seated ? "seated" : ""}`}
                style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -78%)` }}
              >
                {p.say && <span className={`cin-say ${p.mood ?? ""}`}>{p.say}</span>}
                <Gopher pose={pose} state={gstate} size={gSize} role={c.role ?? "banker"} look={c.look} title={c.label} />
                <span className="cin-name">{c.label}</span>
              </div>
            );
          })}

          {w.clock && <span className="rst-clock">{w.clock}</span>}
        </div>
      </div>

      <div className={`anim-note anim-beat-${w.beat ?? "neutral"}`}>
        <span className="anim-frameno">{t.toFixed(1)}s</span>
        <span>{w.note || "Press Play and watch the seats."}</span>
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
