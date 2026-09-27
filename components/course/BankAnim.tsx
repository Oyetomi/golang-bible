"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Gopher, type GopherPose, type GopherRole, type GopherState } from "./Gopher";

/* ════════════════════════════════════════════════════════════════════
   BankAnim — a bank hall: teller windows along the top, a queue rope in
   the middle, a vault of account jars on the right, and the street door.

   Customers (gophers) walk between the street, the queue, a teller
   window and the vault. Windows can be labelled (the CPUs a service has,
   "P0"…"P3"), reserved (a cap), or closed. Account jars show a balance
   that changes on the script's clock and can flash green (applied) or
   red (a lost update). Same continuous clock and scrubber as
   RuntimeStage and CinemaAnim.
   ════════════════════════════════════════════════════════════════════ */

export type BankCustomer = { id: string; label: string; role?: GopherRole; look?: "pink" };
export type BankWindow = { label: string; sub?: string };
export type BankAccount = { id: string; label: string; balance: string };

export type BankEvent = {
  at: number;
  note?: string;
  beat?: "problem" | "solution" | "neutral";
  clock?: string;
  /* move a customer: "street", "queue", "w0".."wN" (teller window), "vault", "" (gone) */
  who?: string;
  to?: string;
  say?: string | null;
  mood?: "ok" | "bad" | "wait";
  carry?: string | null; // a slip the customer holds ("+1¢", "login")
  /* an account jar */
  account?: string;
  balance?: string;
  flash?: "ok" | "bad" | null;
  /* a teller window */
  window?: number;
  state?: "open" | "reserved" | "closed";
  tag?: string | null; // small label under the window ("logins only")
  banner?: string | null; // over the whole hall
};

const MOVE = 0.6;
const SPEEDS = [1, 0.5, 2] as const;
const W = 760;
const H = 430;

type Cust = { to: string; from: string | null; since: number; say: string | null; mood?: string; carry: string | null; order: number };

function worldAt(events: BankEvent[], accounts: BankAccount[], t: number) {
  const cust = new Map<string, Cust>();
  const bal = new Map(accounts.map((a) => [a.id, { balance: a.balance, flash: null as string | null, since: 0 }]));
  const win = new Map<number, { state: string; tag: string | null }>();
  let banner: string | null = null;
  let note = "";
  let beat: BankEvent["beat"] = "neutral";
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
    if (e.account) {
      const prev = bal.get(e.account) ?? { balance: "", flash: null, since: 0 };
      bal.set(e.account, {
        balance: e.balance ?? prev.balance,
        flash: e.flash !== undefined ? e.flash : prev.flash,
        since: e.at,
      });
    }
    if (e.window !== undefined) {
      const prev = win.get(e.window) ?? { state: "open", tag: null };
      win.set(e.window, { state: e.state ?? prev.state, tag: e.tag !== undefined ? e.tag : prev.tag });
    }
    if (e.who) {
      const prev = cust.get(e.who);
      const to = e.to ?? prev?.to ?? "street";
      const moved = to !== prev?.to;
      cust.set(e.who, {
        to,
        from: moved ? prev?.to ?? null : prev?.from ?? null,
        since: moved ? e.at : prev?.since ?? e.at,
        say: e.say !== undefined ? e.say : prev?.say ?? null,
        mood: e.mood ?? prev?.mood,
        carry: e.carry !== undefined ? e.carry : prev?.carry ?? null,
        order: moved ? ++stamp : prev?.order ?? ++stamp,
      });
    }
  }
  return { cust, bal, win, banner, note, beat, clock };
}

export function BankAnim({
  title,
  kicker = "bank · live",
  windows,
  accounts = [],
  customers,
  events,
  caption,
  queueLabel = "queue",
  streetLabel = "street",
}: {
  title: string;
  kicker?: string;
  queueLabel?: string;
  streetLabel?: string;
  windows: BankWindow[];
  accounts?: BankAccount[];
  customers: BankCustomer[];
  events: BankEvent[];
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
  const hasVault = accounts.length > 0;
  const vaultW = hasVault ? 190 : 0;
  const hallW = W - 32 - (hasVault ? vaultW + 14 : 0);
  const winTop = 16;
  const winH = 120;
  const n = windows.length;
  const winGap = 10;
  const winW = (hallW - winGap * (n - 1)) / n;
  const queueTop = winTop + winH + 26;
  const queueH = 120;
  const streetTop = queueTop + queueH + 16;
  const streetH = H - streetTop - 14;

  const w = worldAt(sorted, accounts, t);

  const inList = (where: string) =>
    [...w.cust.entries()].filter(([, c]) => c.to === where).sort((a, b) => a[1].order - b[1].order).map(([id]) => id);
  const queue = inList("queue");
  const street = inList("street");
  const vault = inList("vault");

  const spotOf = (where: string | null, id: string): { x: number; y: number } | null => {
    if (where === null || where === "") return null;
    if (where.startsWith("w")) {
      const i = Number(where.slice(1));
      const here = inList(where);
      const k = Math.max(0, here.indexOf(id));
      return { x: 16 + i * (winW + winGap) + winW / 2 + (k - (here.length - 1) / 2) * 26, y: winTop + winH - 8 };
    }
    if (where === "queue") {
      const k = Math.max(0, queue.indexOf(id));
      const step = Math.min(60, (hallW - 60) / Math.max(1, queue.length));
      return { x: 16 + hallW - 40 - k * step, y: queueTop + queueH - 22 };
    }
    if (where === "vault") {
      const k = Math.max(0, vault.indexOf(id));
      return { x: W - 16 - vaultW / 2 + (k - (vault.length - 1) / 2) * 30, y: streetTop + streetH - 16 };
    }
    // street
    const k = Math.max(0, street.indexOf(id));
    const step = Math.min(64, (hallW - 40) / Math.max(1, street.length));
    return { x: 16 + 34 + k * step, y: streetTop + streetH - 16 };
  };

  const toggle = () => {
    if (t >= end) setT(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="rst bank">
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

      <div className="rst-viewport bank-viewport" ref={wrap} style={{ height: H * scale }}>
        <div className="rst-world" style={{ width: W, height: H, transform: `scale(${scale})` } as CSSProperties}>
          {windows.map((wd, i) => {
            const st = w.win.get(i) ?? { state: "open", tag: null };
            const busy = inList(`w${i}`).length > 0;
            return (
              <div
                key={i}
                className={`bank-win ${st.state} ${busy ? "busy" : ""}`}
                style={{ left: 16 + i * (winW + winGap), top: winTop, width: winW, height: winH }}
              >
                <span className="bank-wlabel">{wd.label}</span>
                {wd.sub && <span className="bank-wsub">{wd.sub}</span>}
                <span className="bank-counter" />
                {st.tag && <span className="bank-wtag">{st.tag}</span>}
              </div>
            );
          })}

          <div className="bank-queue" style={{ left: 16, top: queueTop, width: hallW, height: queueH }}>
            <span className="bank-zlabel">{queueLabel}</span>
            <svg className="bank-rope" width={hallW} height="12" viewBox={`0 0 ${hallW} 12`} aria-hidden>
              <path d={`M 10 4 Q ${hallW / 4} 12 ${hallW / 2} 4 Q ${(3 * hallW) / 4} 12 ${hallW - 10} 4`} fill="none" strokeWidth="2" />
            </svg>
          </div>
          <div className="bank-street" style={{ left: 16, top: streetTop, width: hallW, height: streetH }}>
            <span className="bank-zlabel">{streetLabel}</span>
          </div>

          {hasVault && (
            <div className="bank-vault" style={{ left: W - 16 - vaultW, top: winTop, width: vaultW, height: H - 30 }}>
              <span className="bank-zlabel">vault</span>
              {accounts.map((a, i) => {
                const b = w.bal.get(a.id);
                const flashing = b?.flash && t - (b?.since ?? 0) < 2.2;
                return (
                  <div key={a.id} className={`bank-jar ${flashing ? `flash-${b?.flash}` : ""} ${b?.flash === "bad" ? "wrong" : ""}`} style={{ top: 34 + i * 74 }}>
                    <span className="bank-jar-label">{a.label}</span>
                    <span className="bank-jar-bal">{b?.balance ?? a.balance}</span>
                  </div>
                );
              })}
            </div>
          )}

          {w.banner && <span className="bank-banner">{w.banner}</span>}

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
              y = start.y + (target.y - start.y) * e - Math.sin(Math.PI * k) * 36;
            }
            const moving = Boolean(start);
            const atWindow = p.to.startsWith("w");
            const pose: GopherPose = moving ? (p.carry ? "carry" : "run") : p.mood === "bad" ? "panic" : p.mood === "ok" ? "happy" : p.mood === "wait" ? "blocked" : p.carry ? "carry" : "idle";
            // Mood shows in pose and bubble; fur colour is the customer's own.
            const gstate: GopherState = p.mood === "ok" ? "done" : p.mood === "wait" ? "warn" : atWindow ? "active" : "idle";
            return (
              <div
                key={c.id}
                className={`bank-cust ${moving ? "moving" : ""}`}
                style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -80%)` }}
              >
                {p.say && <span className={`cin-say ${p.mood ?? ""}`}>{p.say}</span>}
                <Gopher pose={pose} state={gstate} size={34} role={c.role ?? "banker"} look={c.look} payload={p.carry ?? undefined} title={c.label} />
                <span className="cin-name">{c.label}</span>
              </div>
            );
          })}

          {w.clock && <span className="rst-clock">{w.clock}</span>}
        </div>
      </div>

      <div className={`anim-note anim-beat-${w.beat ?? "neutral"}`}>
        <span className="anim-frameno">{t.toFixed(1)}s</span>
        <span>{w.note || "Press Play and watch the windows."}</span>
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
