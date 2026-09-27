"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Gopher, type GopherPose, type GopherRole, type GopherState } from "./Gopher";

/* ════════════════════════════════════════════════════════════════════
   PostRoomAnim — the cinema's back office, where background jobs run.

   Left: the bookings ledger (Postgres). Top: the queue, a conveyor belt
   of envelopes (jobs). Middle: worker desks. Right: each customer's
   mailbox, counting the emails that reach it (two for one booking turns
   it red). Bottom: the retry shelf and the dead-letter bin, or, for the
   scheduler scenes, a strip of clock ticks showing who ran each one.

   Envelopes move between "queue", "w:<worker>", "retry", "dead",
   "mail:<customer>" and "" (gone). Workers can be working, dead (kill -9)
   or frozen (SIGSTOP), and one of them can wear the leader's crown.
   Same continuous clock and scrubber as BankAnim and CinemaAnim.
   ════════════════════════════════════════════════════════════════════ */

export type PostWorker = { id: string; label: string; role?: GopherRole; look?: "pink" };
export type PostCustomer = { id: string; label: string; look?: "pink" };
export type PostJob = { id: string; label: string };
export type PostBooking = { id: string; label: string };

export type PostEvent = {
  at: number;
  note?: string;
  beat?: "problem" | "solution" | "neutral";
  clock?: string;
  banner?: string | null;
  /* an envelope */
  job?: string;
  to?: string;
  tag?: string | null;
  /* a worker */
  worker?: string;
  wstate?: "idle" | "working" | "dead" | "frozen";
  say?: string | null;
  /* the leader's crown */
  lease?: string | null;
  /* a customer at their mailbox */
  cust?: string;
  csay?: string | null;
  mood?: "ok" | "bad" | "wait";
  /* a row in the bookings ledger */
  booking?: string;
  bstate?: "ok" | "pending" | "gone";
  /* a clock tick in the scheduler strip: who ran it ("r1 r3") */
  tick?: string;
  ran?: string;
};

const MOVE = 0.6;
const SPEEDS = [1, 0.5, 2] as const;
const W = 760;
const H = 440;

type Env = { to: string; from: string | null; since: number; tag: string | null; order: number };

function worldAt(events: PostEvent[], t: number) {
  const env = new Map<string, Env>();
  const wk = new Map<string, { state: string; say: string | null }>();
  const cu = new Map<string, { say: string | null; mood?: string }>();
  const bk = new Map<string, string>();
  const mail = new Map<string, Map<string, number>>(); // customer → job → arrival time
  const ticks: { tick: string; ran: string[] }[] = [];
  let lease: string | null = null;
  let banner: string | null = null;
  let note = "";
  let beat: PostEvent["beat"] = "neutral";
  let clock = "";
  let stamp = 0;
  for (const e of events) {
    if (e.at > t) break;
    if (e.note !== undefined) {
      note = e.note;
      beat = e.beat ?? "neutral";
    }
    if (e.clock !== undefined) clock = e.clock;
    if (e.banner !== undefined) banner = e.banner;
    if (e.lease !== undefined) lease = e.lease;
    if (e.booking) bk.set(e.booking, e.bstate ?? "ok");
    if (e.tick) {
      const ran = (e.ran ?? "").split(/\s+/).filter(Boolean);
      const row = ticks.find((r) => r.tick === e.tick);
      if (row) row.ran = ran;
      else ticks.push({ tick: e.tick, ran });
    }
    if (e.worker) {
      const prev = wk.get(e.worker) ?? { state: "idle", say: null };
      wk.set(e.worker, { state: e.wstate ?? prev.state, say: e.say !== undefined ? e.say : prev.say });
    }
    if (e.cust) {
      const prev = cu.get(e.cust) ?? { say: null };
      cu.set(e.cust, { say: e.csay !== undefined ? e.csay : prev.say, mood: e.mood ?? prev.mood });
    }
    if (e.job) {
      const prev = env.get(e.job);
      const to = e.to ?? prev?.to ?? "queue";
      const moved = to !== prev?.to;
      env.set(e.job, {
        to,
        from: moved ? prev?.to ?? null : prev?.from ?? null,
        since: moved ? e.at : prev?.since ?? e.at,
        tag: e.tag !== undefined ? e.tag : prev?.tag ?? null,
        order: moved ? ++stamp : prev?.order ?? ++stamp,
      });
      if (moved && to.startsWith("mail:")) {
        const c = to.slice(5);
        if (!mail.has(c)) mail.set(c, new Map());
        if (!mail.get(c)!.has(e.job)) mail.get(c)!.set(e.job, e.at + MOVE);
      }
    }
  }
  return { env, wk, cu, bk, mail, ticks, lease, banner, note, beat, clock };
}

export function PostRoomAnim({
  title,
  kicker = "background jobs · live",
  workers,
  customers = [],
  jobs = [],
  bookings,
  events,
  caption,
  queueLabel = "queue · Redis",
  ledgerLabel = "bookings · Postgres",
  mailLabel = "customers' inboxes · Mailpit",
  retryLabel = "retry · waiting out backoff",
  deadLabel = "archived · dead letters",
  countNoun = "email",
}: {
  title: string;
  kicker?: string;
  queueLabel?: string;
  ledgerLabel?: string;
  mailLabel?: string;
  retryLabel?: string;
  deadLabel?: string;
  countNoun?: string;
  workers: PostWorker[];
  customers?: PostCustomer[];
  jobs?: PostJob[];
  bookings?: PostBooking[];
  events: PostEvent[];
  caption?: string;
}) {
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

  // ── layout ──────────────────────────────────────────────────────────
  const hasLedger = Boolean(bookings && bookings.length);
  const hasMail = customers.length > 0;
  const usesTicks = sorted.some((e) => e.tick);
  const usesBins = sorted.some((e) => e.to === "retry" || e.to === "dead");
  const usesQueue = sorted.some((e) => e.to === "queue");
  const ledgerW = hasLedger ? 150 : 0;
  const mailW = hasMail ? 176 : 0;
  const midL = 16 + (hasLedger ? ledgerW + 12 : 0);
  const midR = W - 16 - (hasMail ? mailW + 12 : 0);
  const midW = midR - midL;
  const beltTop = 16;
  const beltH = usesQueue ? 84 : 0;
  const deskTop = usesQueue ? beltTop + beltH + 20 : 16;
  const bottomH = usesTicks && !usesQueue ? 170 : usesTicks || usesBins ? 108 : 0;
  const deskH = H - deskTop - 16 - (bottomH ? bottomH + 14 : 0);
  const bottomTop = deskTop + deskH + 14;
  const nW = Math.max(1, workers.length);
  const deskGap = 10;
  const deskW = (midW - deskGap * (nW - 1)) / nW;
  const mailRowH = hasMail ? Math.min(96, (H - 32 - 24) / customers.length) : 0;

  const w = worldAt(sorted, t);

  const inZone = (where: string) =>
    [...w.env.entries()].filter(([, e]) => e.to === where).sort((a, b) => a[1].order - b[1].order).map(([id]) => id);

  const spotOf = (where: string | null, id: string): { x: number; y: number } | null => {
    if (where === null || where === "") return null;
    if (where === "queue") {
      const here = inZone("queue");
      const k = Math.max(0, here.indexOf(id));
      const step = Math.min(58, (midW - 70) / Math.max(1, here.length));
      return { x: midR - 40 - k * step, y: beltTop + beltH - 30 };
    }
    if (where.startsWith("w:")) {
      const i = Math.max(0, workers.findIndex((x) => x.id === where.slice(2)));
      const here = inZone(where);
      const k = Math.max(0, here.indexOf(id));
      return { x: midL + i * (deskW + deskGap) + deskW / 2 + (k - (here.length - 1) / 2) * 30, y: deskTop + deskH - 96 };
    }
    if (where === "retry" || where === "dead") {
      const here = inZone(where);
      const k = Math.max(0, here.indexOf(id));
      const half = (midW - 12) / 2;
      const x0 = where === "retry" ? midL : midL + half + 12;
      return { x: x0 + 40 + k * 56, y: bottomTop + bottomH - 30 };
    }
    if (where.startsWith("mail:")) {
      const i = Math.max(0, customers.findIndex((c) => c.id === where.slice(5)));
      return { x: W - 16 - 44, y: 32 + i * mailRowH + mailRowH / 2 - 6 };
    }
    return null;
  };

  const toggle = () => {
    if (t >= end) setT(0);
    setPlaying((p) => !p);
  };
  const half = (midW - 12) / 2;

  return (
    <figure className="rst post">
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

      <div className="rst-viewport post-viewport" ref={wrap} style={{ height: H * scale }}>
        <div className="rst-world" style={{ width: W, height: H, transform: `scale(${scale})` } as CSSProperties}>
          {hasLedger && (
            <div className="post-ledger" style={{ left: 16, top: 16, width: ledgerW, height: H - 32 }}>
              <span className="post-zlabel">{ledgerLabel}</span>
              {bookings!.map((b, i) => {
                const st = w.bk.get(b.id);
                if (!st) return null;
                return (
                  <div key={b.id} className={`post-brow ${st}`} style={{ top: 30 + i * 30 }}>
                    <span>{b.label}</span>
                    <span className="post-bstate">{st === "ok" ? "committed" : st === "pending" ? "in tx…" : ""}</span>
                  </div>
                );
              })}
            </div>
          )}

          {usesQueue && (
            <div className="post-belt" style={{ left: midL, top: beltTop, width: midW, height: beltH }}>
              <span className="post-zlabel">{queueLabel}</span>
              <span className="post-rollers" />
            </div>
          )}

          {workers.map((wd, i) => {
            const st = w.wk.get(wd.id) ?? { state: "idle", say: null };
            const x = midL + i * (deskW + deskGap);
            const busy = inZone(`w:${wd.id}`).length > 0;
            const pose: GopherPose = st.state === "dead" ? "sleep" : st.state === "frozen" ? "blocked" : busy || st.state === "working" ? "carry" : "idle";
            const gstate: GopherState = st.state === "dead" ? "bad" : st.state === "frozen" ? "warn" : busy || st.state === "working" ? "active" : "idle";
            return (
              <div key={wd.id} className={`post-desk ${st.state} ${busy ? "busy" : ""}`} style={{ left: x, top: deskTop, width: deskW, height: deskH }}>
                <span className="post-dlabel">{wd.label}</span>
                {w.lease === wd.id && <span className="post-crown" title="holds the lease">♛ leader</span>}
                <span className="post-table" />
                <div className="post-worker">
                  {st.say && <span className="cin-say">{st.say}</span>}
                  <Gopher pose={pose} state={gstate} size={40} role={wd.role ?? "courier"} look={wd.look} title={wd.label} />
                </div>
                {st.state === "dead" && <span className="post-mark dead">kill -9</span>}
                {st.state === "frozen" && <span className="post-mark frozen">SIGSTOP</span>}
              </div>
            );
          })}

          {usesBins && (
            <>
              <div className="post-bin retry" style={{ left: midL, top: bottomTop, width: half, height: bottomH }}>
                <span className="post-zlabel">{retryLabel}</span>
              </div>
              <div className="post-bin dead" style={{ left: midL + half + 12, top: bottomTop, width: half, height: bottomH }}>
                <span className="post-zlabel">{deadLabel}</span>
              </div>
            </>
          )}

          {usesTicks && (
            <div className="post-ticks" style={{ left: midL, top: bottomTop, width: midW, height: bottomH }}>
              <span className="post-zlabel">every second: who ran the sweep</span>
              <div className="post-tickrow">
                {w.ticks.slice(-9).map((r) => (
                  <div key={r.tick} className={`post-tick ${r.ran.length === 0 ? "none" : r.ran.length > 1 ? "many" : "one"}`}>
                    <span className="post-ticktime">{r.tick}</span>
                    <span className="post-tickran">{r.ran.length ? r.ran.join(" ") : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasMail &&
            customers.map((c, i) => {
              const n = [...(w.mail.get(c.id)?.values() ?? [])].filter((arrive) => t >= arrive).length;
              const st = w.cu.get(c.id);
              const y = 16 + i * mailRowH;
              return (
                <div key={c.id} className={`post-mailrow ${n > 1 ? "twice" : n === 1 ? "got" : ""}`} style={{ left: W - 16 - mailW, top: y + 16, width: mailW, height: mailRowH - 8 }}>
                  <div className="post-cust">
                    {st?.say && <span className={`cin-say ${st.mood ?? ""}`}>{st.say}</span>}
                    <Gopher pose={st?.mood === "bad" ? "panic" : n > 0 ? "happy" : "idle"} state={n > 1 ? "warn" : n === 1 ? "done" : "idle"} size={30} look={c.look} role="browser" title={c.label} />
                    <span className="cin-name">{c.label}</span>
                  </div>
                  <div className="post-box">
                    <span className="post-flag" />
                    <span className="post-count">{n}</span>
                    <span className="post-boxlabel">{n > 1 ? `${n} ${countNoun}s!` : n === 1 ? `1 ${countNoun}` : "inbox"}</span>
                  </div>
                </div>
              );
            })}
          {hasMail && <span className="post-zlabel post-maillabel" style={{ left: W - 16 - mailW + 10, top: 14 }}>{mailLabel}</span>}

          {w.banner && <span className="post-banner">{w.banner}</span>}

          {jobs.map((j) => {
            const e = w.env.get(j.id);
            if (!e) return null;
            const target = spotOf(e.to, j.id);
            if (!target) return null;
            let { x, y } = target;
            const k = reduced ? 1 : Math.min(1, Math.max(0, (t - e.since) / MOVE));
            const start = k < 1 ? spotOf(e.from, j.id) : null;
            if (start) {
              const q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
              x = start.x + (target.x - start.x) * q;
              y = start.y + (target.y - start.y) * q - Math.sin(Math.PI * k) * 30;
            }
            const arrived = e.to.startsWith("mail:") && k >= 1;
            return (
              <div
                key={j.id}
                className={`post-env ${start ? "moving" : ""} ${arrived ? "arrived" : ""} ${e.to === "dead" ? "dead" : ""} ${e.to === "retry" ? "retry" : ""}`}
                style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
              >
                <span className="post-envflap" />
                <span className="post-envlabel">{j.label}</span>
                {e.tag && <span className="post-envtag">{e.tag}</span>}
              </div>
            );
          })}

          {w.clock && <span className="rst-clock">{w.clock}</span>}
        </div>
      </div>

      <div className={`anim-note anim-beat-${w.beat ?? "neutral"}`}>
        <span className="anim-frameno">{t.toFixed(1)}s</span>
        <span>{w.note || "Press Play and watch the post room."}</span>
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
