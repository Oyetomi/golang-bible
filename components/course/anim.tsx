"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Gopher, type GopherPose, type GopherRole } from "./Gopher";
import { SPEEDS, speedLabel } from "./client";

/* ──────────────────────────────────────────────
   Bespoke, chapter-tailored animations. Each one
   draws the ACTUAL mechanism of its topic (a
   channel's buffer slots, the GMP run queues, a
   ledger's two-sided posting) instead of generic
   boxes. All share the same stepped-play chrome
   (AnimShell) so the course feels coherent, and
   all collapse to instant states under
   prefers-reduced-motion. No deps beyond React.
   ────────────────────────────────────────────── */

/* shared stepped-playback state with adjustable speed */
function useStepper(total: number, ms = 1500) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setCur((c) => {
        if (c >= total - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, ms / speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, total, ms, speed]);
  return {
    cur,
    playing,
    speed,
    cycleSpeed: () =>
      setSpeed(
        (s) => SPEEDS[(SPEEDS.indexOf(s as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]
      ),
    reset: () => {
      setPlaying(false);
      setCur(0);
    },
    step: () => {
      setPlaying(false);
      setCur((c) => Math.min(c + 1, total - 1));
    },
    toggle: () => {
      if (cur >= total - 1) setCur(0);
      setPlaying((p) => !p);
    },
    go: (i: number) => {
      setPlaying(false);
      setCur(i);
    },
  };
}

/* shared chrome: header controls, narration bar, scrubber dots */
function AnimShell({
  title,
  kicker,
  note,
  beat = "neutral",
  cur,
  total,
  playing,
  speed,
  onSpeed,
  onReset,
  onStep,
  onToggle,
  onGo,
  caption,
  children,
}: {
  title: string;
  kicker: string;
  note: ReactNode;
  beat?: "problem" | "solution" | "neutral";
  cur: number;
  total: number;
  playing: boolean;
  speed?: number;
  onSpeed?: () => void;
  onReset: () => void;
  onStep: () => void;
  onToggle: () => void;
  onGo: (i: number) => void;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="anim">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          {onSpeed && (
            <button
              className="anim-btn"
              onClick={onSpeed}
              aria-label="Playback speed"
              title="Playback speed"
            >
              {speedLabel(speed ?? 1)}
            </button>
          )}
          <button className="anim-btn" onClick={onReset} aria-label="Reset" title="Reset">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button className="anim-btn" onClick={onStep} aria-label="Step forward" title="Step forward">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
          <button className="anim-btn anim-play" onClick={onToggle}>
            {playing ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="anim-stage">{children}</div>
      <div className={`anim-note anim-beat-${beat}`}>
        <span className="anim-frameno">
          {cur + 1}/{total}
        </span>
        <span>{note}</span>
      </div>
      <div className="anim-dots">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            className={`anim-dot ${i === cur ? "on" : ""} ${i < cur ? "past" : ""}`}
            onClick={() => onGo(i)}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      {caption && <figcaption className="anim-cap">{caption}</figcaption>}
    </figure>
  );
}

/* ════════════════════════════════════════════
   ChannelAnim — a Go channel drawn as what it IS:
   an hchan ring buffer between two gophers. Sends
   fill slots, receives drain them, a full buffer
   BLOCKS the sender (it sits down, sweating).
   ════════════════════════════════════════════ */
type ChanOp = {
  op: "send" | "recv" | "note";
  v?: string;
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

export function ChannelAnim({
  title = "Channel",
  capacity = 3,
  sender = "sender",
  receiver = "receiver",
  senderRole,
  receiverRole,
  ops,
  caption,
}: {
  title?: string;
  capacity?: number;
  sender?: string;
  receiver?: string;
  senderRole?: GopherRole;
  receiverRole?: GopherRole;
  ops: ChanOp[];
  caption?: string;
}) {
  const st = useStepper(ops.length);
  // replay ops up to cur to derive buffer contents + blocked state
  const buf: string[] = [];
  let blocked = false;
  let lastRecv: string | null = null;
  for (let i = 0; i <= st.cur && i < ops.length; i++) {
    const o = ops[i];
    if (o.op === "send") {
      if (buf.length < capacity) buf.push(o.v ?? "v");
      else blocked = i === st.cur; // a send into a full buffer blocks NOW
    } else if (o.op === "recv") {
      lastRecv = buf.shift() ?? null;
      blocked = false;
    }
  }
  const now = ops[st.cur];
  const sending = now?.op === "send" && !blocked;
  const receiving = now?.op === "recv";
  return (
    <AnimShell
      title={title}
      kicker="channel"
      note={now?.note ?? ""}
      beat={now?.beat ?? (blocked ? "problem" : "neutral")}
      cur={st.cur}
      total={ops.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="chan">
        <div className="chan-side">
          <Gopher
            pose={blocked ? "blocked" : sending ? "carry" : "idle"}
            state={blocked ? "warn" : sending ? "active" : "idle"}
            payload={sending ? now?.v : undefined}
            size={52}
            role={senderRole}
            title={sender}
          />
          <span className="chan-name">{sender}</span>
          {blocked && <span className="chan-blocked">blocked!</span>}
        </div>
        <div className="chan-pipe" style={{ "--cap": String(capacity) } as CSSProperties}>
          <span className="chan-arrow">→</span>
          {Array.from({ length: capacity }, (_, i) => (
            <span
              key={i}
              className={`chan-slot ${i < buf.length ? "full" : ""}`}
            >
              {i < buf.length ? buf[i] : ""}
            </span>
          ))}
          <span className="chan-arrow">→</span>
        </div>
        <div className="chan-side">
          <Gopher
            pose={receiving ? "carry" : "idle"}
            state={receiving ? "ok" : "idle"}
            payload={receiving ? lastRecv ?? undefined : undefined}
            size={52}
            role={receiverRole}
            title={receiver}
            flip
          />
          <span className="chan-name">{receiver}</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   SchedulerAnim — the GMP model: P's with local
   run queues of G-gophers, M threads underneath,
   steps move/steal/park goroutines.
   Declarative frames keep authoring simple.
   ════════════════════════════════════════════ */
type SchedFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** per-P state: queue of goroutine labels; running = head */
  ps: { running?: string; queue: string[]; blocked?: boolean }[];
  /** goroutines waiting in the global run queue */
  global?: string[];
  /** highlight a steal from P[from] to P[to] */
  steal?: { from: number; to: number };
};

export function SchedulerAnim({
  title = "The Go scheduler (G·M·P)",
  frames,
  caption,
}: {
  title?: string;
  frames: SchedFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1800);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="scheduler"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="sched">
        {(f.global?.length ?? 0) > 0 && (
          <div className="sched-global">
            <span className="sched-label">global run queue</span>
            {f.global!.map((g) => (
              <span key={g} className="sched-g">
                {g}
              </span>
            ))}
          </div>
        )}
        <div className="sched-ps">
          {f.ps.map((p, i) => (
            <div
              key={i}
              className={`sched-p ${p.blocked ? "sched-p-blocked" : ""} ${
                f.steal?.from === i ? "sched-steal-from" : ""
              } ${f.steal?.to === i ? "sched-steal-to" : ""}`}
            >
              <span className="sched-label">P{i}</span>
              <div className="sched-running">
                {p.running ? (
                  <>
                    <Gopher pose="run" state="active" size={34} title={p.running} />
                    <span className="sched-g sched-g-run">{p.running}</span>
                  </>
                ) : (
                  <span className="sched-empty">idle</span>
                )}
              </div>
              <div className="sched-queue">
                {p.queue.map((g) => (
                  <span key={g} className="sched-g">
                    {g}
                  </span>
                ))}
              </div>
              <span className="sched-m">M{i}</span>
            </div>
          ))}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   GCAnim — tri-color mark & sweep over a real
   object graph. Nodes recolor white→grey→black;
   sweep collects the white ones, broom gopher
   does the honors.
   ════════════════════════════════════════════ */
type GCNode = { id: string; x: number; y: number; to?: string[] };
type GCFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** node id → color */
  colors: Record<string, "white" | "grey" | "black" | "swept">;
};

export function GCAnim({
  title = "Tri-color mark & sweep",
  nodes,
  frames,
  caption,
}: {
  title?: string;
  nodes: GCNode[];
  frames: GCFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <AnimShell
      title={title}
      kicker="garbage collector"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="gc">
        <div className="gc-gopher">
          <Gopher pose={st.cur === frames.length - 1 ? "happy" : "run"} state="active" size={46} role="sweeper" />
        </div>
        <svg className="gc-svg" viewBox="0 0 400 200">
          {nodes.flatMap(
            (n) =>
              n.to?.map((t) => (
                <line
                  key={`${n.id}-${t}`}
                  x1={n.x}
                  y1={n.y}
                  x2={pos[t]?.x}
                  y2={pos[t]?.y}
                  className="gc-edge"
                />
              )) ?? []
          )}
          {nodes.map((n) => {
            const c = f.colors[n.id] ?? "white";
            return (
              <g key={n.id} className={`gc-node gc-${c}`}>
                <circle cx={n.x} cy={n.y} r="16" />
                <text x={n.x} y={n.y + 4} textAnchor="middle">
                  {n.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   SliceAnim — len/cap header + backing array.
   Append fills, overflow REALLOCATES (old array
   fades, new doubled array slides in) — the
   aliasing story told visually.
   ════════════════════════════════════════════ */
type SliceFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  len: number;
  cap: number;
  cells: string[]; // backing array contents (cap long, "" = unset)
  /** second slice header aliasing the same array (the gotcha) */
  alias?: { name: string; from: number; len: number };
  realloc?: boolean; // this frame shows a fresh backing array
};

export function SliceAnim({
  title = "Slice: header + backing array",
  name = "s",
  frames,
  caption,
}: {
  title?: string;
  name?: string;
  frames: SliceFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="slice internals"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="slc">
        <div className="slc-hdr">
          <span className="slc-name">{name}</span>
          <span className="slc-field">ptr ↘</span>
          <span className="slc-field">len {f.len}</span>
          <span className="slc-field">cap {f.cap}</span>
        </div>
        <div className={`slc-arr ${f.realloc ? "slc-realloc" : ""}`}>
          {Array.from({ length: f.cap }, (_, i) => (
            <span
              key={`${f.realloc ? "n" : "o"}${i}`}
              className={`slc-cell ${i < f.len ? "in-len" : ""} ${
                f.cells[i] ? "filled" : ""
              } ${
                f.alias && i >= f.alias.from && i < f.alias.from + f.alias.len
                  ? "aliased"
                  : ""
              }`}
            >
              {f.cells[i] ?? ""}
            </span>
          ))}
        </div>
        {f.alias && (
          <div className="slc-hdr slc-hdr-alias">
            <span className="slc-name">{f.alias.name}</span>
            <span className="slc-field">ptr ↗ (same array!)</span>
            <span className="slc-field">len {f.alias.len}</span>
          </div>
        )}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LockAnim — a mutex as a door with one key.
   Gophers queue; without the lock they trample
   the same value (race); with it, one enters at
   a time. The race chapters' centerpiece.
   ════════════════════════════════════════════ */
type LockFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  holder?: string; // gopher inside the critical section
  waiting: string[]; // queue outside
  value: string; // the shared value on the table
  corrupted?: boolean;
};

export function LockAnim({
  title = "Mutex: one key, one gopher",
  resource = "balance",
  frames,
  caption,
}: {
  title?: string;
  resource?: string;
  frames: LockFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="mutual exclusion"
      note={f.note}
      beat={f.beat ?? (f.corrupted ? "problem" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="lck">
        <div className="lck-queue">
          {f.waiting.map((w) => (
            <span key={w} className="lck-waiter">
              <Gopher pose="blocked" state="warn" size={40} title={w} />
              <span className="lck-name">{w}</span>
            </span>
          ))}
        </div>
        <div className={`lck-section ${f.corrupted ? "lck-bad" : ""}`}>
          <span className="lck-label">critical section</span>
          {f.holder ? (
            <span className="lck-holder">
              <Gopher pose="run" state="active" size={46} role="guard" title={f.holder} />
              <span className="lck-name">{f.holder} 🔑</span>
            </span>
          ) : (
            <span className="lck-empty">unlocked</span>
          )}
          <span className={`lck-value ${f.corrupted ? "bad" : ""}`}>
            {resource} = {f.value}
          </span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LedgerAnim — double-entry posting: a transfer
   posts a debit and a credit that MUST sum to 0.
   Running totals + balance check per frame.
   ════════════════════════════════════════════ */
type LedgerRow = { account: string; debit?: number; credit?: number };
type LedgerFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  rows: LedgerRow[]; // rows posted SO FAR
  pendingRow?: LedgerRow; // row being written this frame
};

export function LedgerAnim({
  title = "Double-entry posting",
  currency = "¢",
  frames,
  caption,
}: {
  title?: string;
  currency?: string;
  frames: LedgerFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1800);
  const f = frames[st.cur] ?? frames[0];
  const rows = [...f.rows, ...(f.pendingRow ? [f.pendingRow] : [])];
  const dr = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const cr = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
  const balanced = dr === cr;
  return (
    <AnimShell
      title={title}
      kicker="ledger"
      note={f.note}
      beat={f.beat ?? (balanced ? "neutral" : "problem")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="ldg">
        <div className="ldg-gopher">
          <Gopher
            pose={balanced ? "happy" : "panic"}
            state={balanced ? "ok" : "bad"}
            size={46}
            role="scribe"
          />
        </div>
        <table className="ldg-table">
          <thead>
            <tr>
              <th>account</th>
              <th>debit</th>
              <th>credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.account}-${i}`}
                className={f.pendingRow && i === rows.length - 1 ? "ldg-new" : ""}
              >
                <td>{r.account}</td>
                <td>{r.debit ? `${r.debit}${currency}` : ""}</td>
                <td>{r.credit ? `${r.credit}${currency}` : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={balanced ? "ldg-ok" : "ldg-off"}>
              <td>{balanced ? "✓ books balance" : "✗ books DO NOT balance"}</td>
              <td>{dr}{currency}</td>
              <td>{cr}{currency}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   JourneyAnim — a request hopping across infra:
   each hop lights up in sequence and the packet
   token physically travels the path.
   ════════════════════════════════════════════ */
type Hop = { id: string; label: string; role?: GopherRole };
type JourneyFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  at: string; // hop id the packet is at
  failed?: boolean;
};

export function JourneyAnim({
  title = "Journey of a request",
  hops,
  frames,
  caption,
}: {
  title?: string;
  hops: Hop[];
  frames: JourneyFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1600);
  const f = frames[st.cur] ?? frames[0];
  const atIdx = hops.findIndex((h) => h.id === f.at);
  return (
    <AnimShell
      title={title}
      kicker="request path"
      note={f.note}
      beat={f.beat ?? (f.failed ? "problem" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="jny">
        {hops.map((h, i) => (
          <Fragment key={h.id}>
            <div
              className={`jny-hop ${i === atIdx ? "at" : ""} ${
                i < atIdx ? "past" : ""
              } ${i === atIdx && f.failed ? "failed" : ""}`}
            >
              <Gopher
                pose={i === atIdx ? (f.failed ? "panic" : "carry") : i < atIdx ? "happy" : "idle"}
                state={i === atIdx ? (f.failed ? "bad" : "active") : i < atIdx ? "done" : "idle"}
                size={42}
                role={h.role}
                title={h.label}
              />
              <span className="jny-label">{h.label}</span>
            </div>
            {i < hops.length - 1 && (
              <span className={`jny-link ${i < atIdx ? "past" : ""}`} />
            )}
          </Fragment>
        ))}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   AlgoGrid — DSA workhorse: an array of cells
   with named POINTER GOPHERS underneath (two
   pointers, sliding window, binary search, DP).
   ════════════════════════════════════════════ */
type AlgoFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  cells?: string[]; // override cell contents this frame
  /** pointer name → cell index */
  pointers: Record<string, number>;
  /** [start, end] inclusive highlight (the window / search range) */
  window?: [number, number];
  /** cell indexes done/eliminated */
  done?: number[];
};

export function AlgoGrid({
  title = "Algorithm walkthrough",
  cells,
  frames,
  caption,
}: {
  title?: string;
  cells: string[];
  frames: AlgoFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1500);
  const f = frames[st.cur] ?? frames[0];
  const content = f.cells ?? cells;
  const ptrEntries = Object.entries(f.pointers);
  return (
    <AnimShell
      title={title}
      kicker="algorithm"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="alg" style={{ "--n": String(content.length) } as CSSProperties}>
        <div className="alg-row">
          {content.map((c, i) => (
            <span
              key={i}
              className={`alg-cell ${
                f.window && i >= f.window[0] && i <= f.window[1] ? "in-window" : ""
              } ${f.done?.includes(i) ? "done" : ""} ${
                ptrEntries.some(([, p]) => p === i) ? "pointed" : ""
              }`}
            >
              {c}
              <i className="alg-idx">{i}</i>
            </span>
          ))}
        </div>
        <div className="alg-ptrs">
          {ptrEntries.map(([name, idx]) => (
            <span
              key={name}
              className="alg-ptr"
              style={{ "--at": String(idx) } as CSSProperties}
            >
              <Gopher pose="run" state="active" size={30} role="scholar" title={name} />
              <span className="alg-ptr-name">{name}</span>
            </span>
          ))}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   MapAnim — a Go map as it actually is: buckets
   holding key slots, a hashing gopher routing
   each key to hash(k) % B, collisions landing in
   the next slot, overflow chaining.
   ════════════════════════════════════════════ */
type MapFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** bucket contents: buckets[i] = array of key labels in slots */
  buckets: string[][];
  /** key currently being hashed/routed (shown in the gopher's hands) */
  hashing?: string;
  /** highlight a landing spot */
  to?: { bucket: number; slot: number };
};

export function MapAnim({
  title = "Inside a Go map",
  slots = 3,
  frames,
  caption,
}: {
  title?: string;
  slots?: number;
  frames: MapFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="map internals"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="mapa">
        <div className="mapa-hasher">
          <Gopher
            pose={f.hashing ? "carry" : "idle"}
            state={f.hashing ? "active" : "idle"}
            payload={f.hashing}
            size={48}
            role="librarian"
            title="hash router"
          />
          <span className="mapa-fn">hash(key) % {f.buckets.length}</span>
        </div>
        <div className="mapa-buckets">
          {f.buckets.map((b, bi) => (
            <div key={bi} className={`mapa-bucket ${f.to?.bucket === bi ? "landing" : ""}`}>
              <span className="mapa-bn">b{bi}</span>
              {Array.from({ length: Math.max(slots, b.length) }, (_, si) => (
                <span
                  key={si}
                  className={`mapa-slot ${b[si] ? "full" : ""} ${
                    f.to?.bucket === bi && f.to?.slot === si ? "hot" : ""
                  } ${si >= slots ? "overflow" : ""}`}
                >
                  {b[si] ?? ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   StackHeapAnim — escape analysis made visible:
   stack frames on the left, heap on the right,
   a value visibly ESCAPING from one to the other,
   and the sweeper gopher who now has to manage it.
   ════════════════════════════════════════════ */
type StackHeapFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  stack: { fn: string; vars: string[] }[]; // top of stack = last entry
  heap: string[];
  escaping?: string; // var label shown mid-flight to the heap
};

export function StackHeapAnim({
  title = "Stack vs heap — escape analysis",
  frames,
  caption,
}: {
  title?: string;
  frames: StackHeapFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="escape analysis"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="shp">
        <div className="shp-col">
          <span className="shp-label">stack (free: pop &amp; gone)</span>
          <div className="shp-stack">
            {f.stack.length === 0 && <span className="shp-empty">empty</span>}
            {[...f.stack].reverse().map((fr) => (
              <div key={fr.fn} className="shp-frame">
                <span className="shp-fn">{fr.fn}</span>
                {fr.vars.map((v) => (
                  <span key={v} className="shp-var">{v}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
        {f.escaping && (
          <div className="shp-escape">
            <span className="shp-escaping">{f.escaping}</span>
            <span className="shp-arrow">⟶</span>
          </div>
        )}
        <div className="shp-col">
          <span className="shp-label">heap (free: GC must prove it dead)</span>
          <div className="shp-heap">
            <span className="shp-gc">
              <Gopher pose={f.heap.length > 2 ? "blocked" : "idle"} state={f.heap.length > 2 ? "warn" : "idle"} size={36} role="sweeper" title="GC" />
            </span>
            {f.heap.map((h) => (
              <span key={h} className="shp-blob">{h}</span>
            ))}
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   GraphAnim — trees ARE graphs: nodes + edges in
   SVG with per-frame node states and a walking
   scholar gopher. Powers BFS/DFS/Dijkstra/BST
   walkthroughs and heap sift paths.
   ════════════════════════════════════════════ */
type GraphNode = { id: string; label?: string; x: number; y: number; to?: string[] };
type GraphState = "idle" | "frontier" | "visit" | "done" | "found" | "reject";
type GraphFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  nodes: Record<string, GraphState>;
  /** edges to light up, as "a-b" using node ids */
  edges?: string[];
  /** node the gopher currently stands at */
  at?: string;
};

export function GraphAnim({
  title = "Graph walkthrough",
  nodes,
  height = 230,
  frames,
  caption,
}: {
  title?: string;
  nodes: GraphNode[];
  height?: number;
  frames: GraphFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1600);
  const f = frames[st.cur] ?? frames[0];
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const lit = new Set(f.edges ?? []);
  const at = f.at ? pos[f.at] : null;
  return (
    <AnimShell
      title={title}
      kicker="traversal"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="grf">
        <svg className="grf-svg" viewBox={`0 0 460 ${height}`}>
          {nodes.flatMap(
            (n) =>
              n.to?.map((t) => (
                <line
                  key={`${n.id}-${t}`}
                  x1={n.x}
                  y1={n.y}
                  x2={pos[t]?.x}
                  y2={pos[t]?.y}
                  className={`grf-edge ${
                    lit.has(`${n.id}-${t}`) || lit.has(`${t}-${n.id}`) ? "lit" : ""
                  }`}
                />
              )) ?? []
          )}
          {nodes.map((n) => {
            const s = f.nodes[n.id] ?? "idle";
            const label = n.label ?? n.id;
            const isShort = label.length <= 3;
            return (
              <g key={n.id} className={`grf-node grf-${s}`}>
                <circle cx={n.x} cy={n.y} r="15" />
                {isShort ? (
                  <text x={n.x} y={n.y + 4} textAnchor="middle" className="grf-node-text">
                    {label}
                  </text>
                ) : (
                  <>
                    <text x={n.x} y={n.y + 4} textAnchor="middle" className="grf-node-id">
                      {n.id}
                    </text>
                    <g className="grf-tag">
                      <rect
                        x={n.x - label.length * 3.8 - 6}
                        y={n.y + 18}
                        width={label.length * 7.6 + 12}
                        height="18"
                        rx="4"
                        className="grf-tag-bg"
                      />
                      <text x={n.x} y={n.y + 31} textAnchor="middle" className="grf-tag-text">
                        {label}
                      </text>
                    </g>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        {at && (
          <span
            className="grf-walker"
            style={{ left: `${(at.x / 460) * 100}%`, top: `${(at.y / height) * 100}%` } as CSSProperties}
          >
            <Gopher pose="run" state="active" size={32} role="scholar" title="walker" />
          </span>
        )}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   CacheAnim — cache-aside, hits, misses, and the
   9 a.m. stampede: client gophers, a cache box
   with keyed slots, and the database that pays
   for every miss.
   ════════════════════════════════════════════ */
type CacheFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  clients: number; // how many client gophers are asking right now
  cache: string[]; // keys currently cached
  flow?: "hit" | "miss" | "fill" | "stampede" | "locked";
  dbCalls: number;
};

export function CacheAnim({
  title = "Cache-aside",
  frames,
  caption,
}: {
  title?: string;
  frames: CacheFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const overload = f.dbCalls > 3;
  return (
    <AnimShell
      title={title}
      kicker="caching"
      note={f.note}
      beat={f.beat ?? (overload ? "problem" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="cch">
        <div className="cch-clients">
          {Array.from({ length: f.clients }, (_, i) => (
            <Gopher
              key={i}
              pose={f.flow === "hit" ? "happy" : f.flow === "locked" && i > 0 ? "blocked" : "run"}
              state={f.flow === "hit" ? "ok" : f.flow === "stampede" ? "bad" : "active"}
              size={34}
              title={`client ${i + 1}`}
            />
          ))}
          <span className="cch-name">{f.clients} request{f.clients === 1 ? "" : "s"}</span>
        </div>
        <div className={`cch-box ${f.flow === "hit" ? "cch-hit" : ""} ${f.flow === "miss" || f.flow === "stampede" ? "cch-miss" : ""}`}>
          <span className="cch-label">cache</span>
          <div className="cch-slots">
            {f.cache.length === 0 && <span className="cch-empty">empty</span>}
            {f.cache.map((k) => (
              <span key={k} className="cch-key">{k}</span>
            ))}
          </div>
        </div>
        <div className={`cch-db ${overload ? "cch-db-hot" : ""}`}>
          <Gopher
            pose={overload ? "panic" : f.dbCalls > 0 ? "carry" : "idle"}
            state={overload ? "bad" : f.dbCalls > 0 ? "active" : "idle"}
            size={44}
            role="librarian"
            title="database"
          />
          <span className="cch-name">DB — {f.dbCalls} quer{f.dbCalls === 1 ? "y" : "ies"}</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   CircuitAnim — a circuit breaker as the gate it
   is: closed (requests flow), open (gate slams,
   instant failure), half-open (one probe gopher
   allowed through).
   ════════════════════════════════════════════ */
type CircuitFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  state: "closed" | "open" | "half";
  failures?: number;
  probe?: "ok" | "fail";
};

export function CircuitAnim({
  title = "Circuit breaker",
  downstream = "card processor",
  frames,
  caption,
}: {
  title?: string;
  downstream?: string;
  frames: CircuitFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="reliability"
      note={f.note}
      beat={f.beat ?? (f.state === "open" ? "problem" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="cir">
        <div className="cir-side">
          <Gopher
            pose={f.state === "open" ? "blocked" : "run"}
            state={f.state === "open" ? "warn" : "active"}
            size={46}
            role="banker"
            title="checkout"
          />
          <span className="cir-name">checkout</span>
        </div>
        <div className={`cir-gate cir-${f.state}`}>
          <span className="cir-state">
            {f.state === "closed" ? "CLOSED — flowing" : f.state === "open" ? "OPEN — fail fast" : "HALF-OPEN — probing"}
          </span>
          <span className="cir-bar" />
          {typeof f.failures === "number" && (
            <span className="cir-fails">{f.failures} consecutive failures</span>
          )}
        </div>
        <div className="cir-side">
          <Gopher
            pose={f.state === "open" ? "sleep" : f.probe === "fail" ? "panic" : "idle"}
            state={f.state === "open" ? "idle" : f.probe === "fail" ? "bad" : f.probe === "ok" ? "ok" : "idle"}
            size={46}
            role="operator"
            title={downstream}
          />
          <span className="cir-name">{downstream}</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   PoolAnim — a connection pool: fixed slots,
   borrower gophers taking and returning conns,
   the queue that forms when the pool is dry.
   ════════════════════════════════════════════ */
type PoolFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** slot contents: null = free, string = borrower name */
  pool: (string | null)[];
  waiting?: string[];
};

export function PoolAnim({
  title = "Connection pool",
  frames,
  caption,
}: {
  title?: string;
  frames: PoolFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="database/sql pool"
      note={f.note}
      beat={f.beat ?? ((f.waiting?.length ?? 0) > 0 ? "problem" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="pol">
        {(f.waiting?.length ?? 0) > 0 && (
          <div className="pol-queue">
            {f.waiting!.map((w) => (
              <span key={w} className="pol-waiter">
                <Gopher pose="blocked" state="warn" size={34} title={w} />
                <span className="pol-name">{w}</span>
              </span>
            ))}
          </div>
        )}
        <div className="pol-slots">
          {f.pool.map((s, i) => (
            <div key={i} className={`pol-slot ${s ? "used" : "free"}`}>
              <span className="pol-conn">conn {i + 1}</span>
              {s ? (
                <>
                  <Gopher pose="run" state="active" size={32} title={s} />
                  <span className="pol-name">{s}</span>
                </>
              ) : (
                <span className="pol-free">free</span>
              )}
            </div>
          ))}
        </div>
        <div className="pol-db">
          <Gopher pose="idle" state="idle" size={40} role="librarian" title="Postgres" />
          <span className="pol-name">Postgres</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   TerminalAnim — a real terminal window, because
   a command-line topic should LOOK like a command
   line, not a gopher on a lane. Two modes:
   • line mode: a shell session — each frame types
     a `$ cmd` and reveals its output; scrollback
     accumulates so it reads like a real session.
   • screen mode: a frame supplies `screen` (lines)
     that REPLACE the body each step — for TUIs /
     full-screen apps (Bubble Tea, a redraw loop).
   ════════════════════════════════════════════ */
type TermFrame = {
  cmd?: string; // typed at the prompt this frame (line mode)
  out?: string[]; // output the command prints (line mode)
  screen?: string[]; // full-screen body that replaces the terminal (screen mode)
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

export function TerminalAnim({
  title = "terminal",
  prompt = "$",
  frames,
  caption,
}: {
  title?: string;
  prompt?: string;
  frames: TermFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const screenMode = !!f.screen;

  // line mode: accumulate every command+output up to and including the current frame
  const history: { kind: "cmd" | "out" | "blank"; text: string; cur?: boolean }[] = [];
  if (!screenMode) {
    for (let i = 0; i <= st.cur; i++) {
      const fr = frames[i];
      if (fr.screen) continue;
      if (fr.cmd !== undefined) history.push({ kind: "cmd", text: fr.cmd, cur: i === st.cur });
      // only show output for frames strictly before the current one, OR the
      // current one once its command has "landed" (we reveal both together)
      if (fr.out) for (const line of fr.out) history.push({ kind: "out", text: line });
      if (i !== st.cur) history.push({ kind: "blank", text: "" });
    }
  }

  return (
    <AnimShell
      title={title}
      kicker="terminal"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="term" role="img" aria-label={title}>
        <div className="term-bar">
          <span className="term-dot term-dot-r" />
          <span className="term-dot term-dot-y" />
          <span className="term-dot term-dot-g" />
          <span className="term-bar-title">{title}</span>
        </div>
        <div className={`term-body ${screenMode ? "term-screen" : ""}`}>
          {screenMode
            ? (f.screen ?? []).map((line, i) => (
                <div className="term-line term-tui" key={i}>
                  {line || " "}
                </div>
              ))
            : history.map((h, i) =>
                h.kind === "cmd" ? (
                  <div className="term-line" key={i}>
                    <span className="term-prompt">{prompt}</span>{" "}
                    <span className="term-cmd">{h.text}</span>
                    {h.cur && <span className="term-cursor" aria-hidden />}
                  </div>
                ) : h.kind === "blank" ? (
                  <div className="term-line" key={i}>
                    &nbsp;
                  </div>
                ) : (
                  <div className="term-line term-out" key={i}>
                    {h.text || " "}
                  </div>
                )
              )}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   HttpAnim — an HTTP exchange drawn as what it
   IS: a request card (method, path, headers,
   body) leaving the client, a packet crossing
   the wire, the server responding with a status
   card. The artifact is the illustration, not a
   gopher on a lane.
   ════════════════════════════════════════════ */
type HttpHeader = { k: string; v: string };
type HttpPhase = "compose" | "request" | "server" | "response" | "done";
type HttpFrame = { phase: HttpPhase; note: string; beat?: "problem" | "solution" | "neutral" };

export function HttpAnim({
  title = "HTTP exchange",
  method = "GET",
  path = "/",
  host,
  reqHeaders = [],
  reqBody,
  status = 200,
  statusText = "OK",
  resHeaders = [],
  resBody,
  frames,
  caption,
}: {
  title?: string;
  method?: string;
  path?: string;
  host?: string;
  reqHeaders?: HttpHeader[];
  reqBody?: string;
  status?: number;
  statusText?: string;
  resHeaders?: HttpHeader[];
  resBody?: string;
  frames: HttpFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const reqVisible = f.phase !== "compose";
  const resVisible = f.phase === "response" || f.phase === "done";
  const wire =
    f.phase === "request" ? "up" : f.phase === "response" ? "down" : f.phase === "server" ? "wait" : "idle";
  const statusClass = status >= 500 ? "bad" : status >= 400 ? "warn" : "ok";

  return (
    <AnimShell
      title={title}
      kicker="http"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="http">
        <div className="http-node">
          <Gopher pose="idle" state="idle" size={34} role="operator" title="client" />
          <span className="http-node-label">client</span>
        </div>

        <div className="http-mid">
          <div className={`http-card http-req ${reqVisible ? "on" : "off"}`}>
            <div className="http-req-line">
              <span className="http-method">{method}</span> {path}{" "}
              <span className="http-ver">HTTP/1.1</span>
            </div>
            {host && (
              <div className="http-hdr">
                <span className="http-hk">Host:</span> {host}
              </div>
            )}
            {reqHeaders.map((h) => (
              <div className="http-hdr" key={h.k}>
                <span className="http-hk">{h.k}:</span> {h.v}
              </div>
            ))}
            {reqBody && <div className="http-body">{reqBody}</div>}
          </div>

          <div className={`http-wire http-wire-${wire}`}>
            <span className="http-packet" aria-hidden />
          </div>

          <div className={`http-card http-res ${resVisible ? "on" : "off"}`}>
            <div className="http-status-line">
              <span className="http-ver">HTTP/1.1</span>{" "}
              <span className={`http-status http-status-${statusClass}`}>
                {status} {statusText}
              </span>
            </div>
            {resHeaders.map((h) => (
              <div className="http-hdr" key={h.k}>
                <span className="http-hk">{h.k}:</span> {h.v}
              </div>
            ))}
            {resBody && <div className="http-body">{resBody}</div>}
          </div>
        </div>

        <div className="http-node">
          <Gopher
            pose={f.phase === "server" ? "run" : "idle"}
            state={f.phase === "server" ? "active" : "idle"}
            size={34}
            role="operator"
            title="server"
          />
          <span className="http-node-label">server</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   SqlAnim — a SQL query and its RESULT SET drawn
   as what they are: a query card and a rows×cols
   table, with rows.Scan consuming one row at a
   time and mapping each column to a struct field
   (in order — the cardinal database/sql rule).
   ════════════════════════════════════════════ */
type SqlFrame = {
  phase: "query" | "result" | "scan" | "done";
  row?: number; // which result row is being scanned (scan phase)
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

export function SqlAnim({
  title = "SQL query",
  query,
  columns,
  fields,
  rows,
  frames,
  caption,
}: {
  title?: string;
  query: string;
  columns: string[];
  fields?: string[]; // struct fields Scan targets, aligned to columns
  rows: string[][];
  frames: SqlFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const showTable = f.phase !== "query";
  const scanRow = f.phase === "scan" ? f.row ?? -1 : -1;
  const scannedThrough =
    f.phase === "done" ? rows.length - 1 : f.phase === "scan" ? (f.row ?? -1) : -1;

  return (
    <AnimShell
      title={title}
      kicker="sql"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="sql">
        <div className="sql-query">
          <span className="sql-prompt">SQL</span>
          <code>{query}</code>
        </div>

        {showTable && (
          <div className="sql-table-wrap">
            <table className="sql-table">
              <thead>
                <tr>
                  {columns.map((c, i) => (
                    <th key={c}>
                      {c}
                      {fields && f.phase === "scan" && (
                        <span className="sql-field"> → {fields[i]}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr
                    key={ri}
                    className={
                      ri === scanRow ? "sql-row-scan" : ri <= scannedThrough ? "sql-row-done" : "sql-row-pending"
                    }
                  >
                    {r.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sql-cursor-note">
              {f.phase === "result" && `${rows.length} rows returned`}
              {f.phase === "scan" && `rows.Next() → Scan row ${(f.row ?? 0) + 1}/${rows.length}`}
              {f.phase === "done" && `✓ scanned ${rows.length} rows into []Account`}
            </div>
          </div>
        )}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   OutboxAnim — Transactional Outbox pattern:
   Atomic DB commit of state + outbox event row,
   followed by CDC/Poller relay publishing to
   Kafka, broker ACK, and outbox cleanup.
   ════════════════════════════════════════════ */
export type OutboxFrame = {
  phase: "idle" | "tx_write" | "tx_commit" | "poll" | "publish" | "ack" | "cleanup";
  txState?: "idle" | "active" | "committed";
  orderRow?: { id: string; user: string; total: string; status: string };
  outboxRow?: { id: string; event: string; status: "PENDING" | "RELAYING" | "PUBLISHED" } | null;
  brokerMessages?: { offset: number; event: string }[];
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

const DEFAULT_OUTBOX_FRAMES: OutboxFrame[] = [
  {
    phase: "idle",
    txState: "idle",
    orderRow: undefined,
    outboxRow: null,
    brokerMessages: [{ offset: 104, event: "UserCreated" }],
    note: "System ready: DB and Kafka broker idle. Incoming client request to create Order #902.",
    beat: "neutral",
  },
  {
    phase: "tx_write",
    txState: "active",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "PENDING" },
    brokerMessages: [{ offset: 104, event: "UserCreated" }],
    note: "BEGIN TX: App writes 'orders' row + 'outbox_events' row inside the SAME ACID transaction.",
    beat: "neutral",
  },
  {
    phase: "tx_commit",
    txState: "committed",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "PENDING" },
    brokerMessages: [{ offset: 104, event: "UserCreated" }],
    note: "COMMIT: Both rows committed to disk atomically. No dual-write split-brain possible.",
    beat: "solution",
  },
  {
    phase: "poll",
    txState: "idle",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "RELAYING" },
    brokerMessages: [{ offset: 104, event: "UserCreated" }],
    note: "CDC / Poller Relay reads pending outbox row e-88 and prepares message packet.",
    beat: "neutral",
  },
  {
    phase: "publish",
    txState: "idle",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "RELAYING" },
    brokerMessages: [{ offset: 104, event: "UserCreated" }],
    note: "Relay sends message payload to Kafka broker topic 'orders.events'.",
    beat: "neutral",
  },
  {
    phase: "ack",
    txState: "idle",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "RELAYING" },
    brokerMessages: [
      { offset: 104, event: "UserCreated" },
      { offset: 105, event: "OrderCreated(#902)" },
    ],
    note: "Kafka broker appends to partition log at offset 105 and replies with ACK.",
    beat: "solution",
  },
  {
    phase: "cleanup",
    txState: "idle",
    orderRow: { id: "#902", user: "alice", total: "$120", status: "created" },
    outboxRow: { id: "e-88", event: "OrderCreated(#902)", status: "PUBLISHED" },
    brokerMessages: [
      { offset: 104, event: "UserCreated" },
      { offset: 105, event: "OrderCreated(#902)" },
    ],
    note: "Relay updates outbox row to PUBLISHED (or deletes it). At-least-once guarantee achieved!",
    beat: "solution",
  },
];

export function OutboxAnim({
  title = "Transactional Outbox: Atomic Commit → Relay",
  frames = DEFAULT_OUTBOX_FRAMES,
  caption,
}: {
  title?: string;
  frames?: OutboxFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1800);
  const f = frames[st.cur] ?? frames[0];
  const isRelaying = f.phase === "poll" || f.phase === "publish";
  const isAcked = f.phase === "ack" || f.phase === "cleanup";

  return (
    <AnimShell
      title={title}
      kicker="outbox pattern"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="obx">
        {/* Left: Application Database */}
        <div className={`obx-db ${f.txState === "active" ? "tx-active" : f.txState === "committed" ? "tx-commit" : ""}`}>
          <div className="obx-hdr">
            <span className="obx-tag">PostgreSQL (ACID)</span>
            <span className={`obx-tx-badge tx-${f.txState ?? "idle"}`}>
              {f.txState === "active" ? "TX: IN PROGRESS" : f.txState === "committed" ? "TX: COMMITTED" : "TX: IDLE"}
            </span>
          </div>

          <div className="obx-tables">
            <div className="obx-tbl">
              <div className="obx-tbl-title">orders</div>
              <table className="obx-grid">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>user</th>
                    <th>total</th>
                    <th>status</th>
                  </tr>
                </thead>
                <tbody>
                  {f.orderRow ? (
                    <tr className="obx-row-on">
                      <td>{f.orderRow.id}</td>
                      <td>{f.orderRow.user}</td>
                      <td>{f.orderRow.total}</td>
                      <td><span className="obx-pill ok">{f.orderRow.status}</span></td>
                    </tr>
                  ) : (
                    <tr className="obx-row-empty">
                      <td colSpan={4}>no uncommitted rows</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="obx-tbl">
              <div className="obx-tbl-title">outbox_events</div>
              <table className="obx-grid">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>event</th>
                    <th>status</th>
                  </tr>
                </thead>
                <tbody>
                  {f.outboxRow ? (
                    <tr className={`obx-row-on st-${f.outboxRow.status.toLowerCase()}`}>
                      <td>{f.outboxRow.id}</td>
                      <td>{f.outboxRow.event}</td>
                      <td>
                        <span className={`obx-pill ${f.outboxRow.status === "PUBLISHED" ? "ok" : f.outboxRow.status === "RELAYING" ? "info" : "warn"}`}>
                          {f.outboxRow.status}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr className="obx-row-empty">
                      <td colSpan={3}>0 pending events</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Center: CDC / Poller Relay */}
        <div className="obx-relay">
          <div className={`obx-pipe wire-left ${isRelaying ? "wire-active" : ""}`}>
            <span className="obx-packet">{isRelaying ? "📦" : "•"}</span>
          </div>

          <div className="obx-gopher-wrap">
            <Gopher
              pose={isRelaying ? "carry" : isAcked ? "happy" : f.txState === "active" ? "run" : "idle"}
              state={isAcked ? "ok" : isRelaying ? "active" : "idle"}
              size={48}
              role="courier"
              payload={isRelaying ? "e-88" : undefined}
              title="CDC / Outbox Relay"
            />
            <span className="obx-name">Outbox Relay</span>
            <span className="obx-subname">
              {f.phase === "publish" ? "Publishing..." : isAcked ? "ACK Received" : f.phase === "poll" ? "Scanning Outbox" : "Polling"}
            </span>
          </div>

          <div className={`obx-pipe wire-right ${f.phase === "publish" ? "wire-active" : f.phase === "ack" ? "wire-ack" : ""}`}>
            <span className="obx-packet">{f.phase === "publish" ? "📨" : f.phase === "ack" ? "✓" : "•"}</span>
          </div>
        </div>

        {/* Right: Message Broker (Kafka) */}
        <div className="obx-broker">
          <div className="obx-hdr">
            <span className="obx-tag">Kafka Cluster</span>
            <span className="obx-topic">topic: orders.events</span>
          </div>

          <div className="obx-partition">
            <div className="obx-part-title">Partition 0 (Log)</div>
            <div className="obx-offsets">
              {(f.brokerMessages ?? [{ offset: 104, event: "UserCreated" }]).map((msg) => (
                <div key={msg.offset} className="obx-msg">
                  <span className="obx-off">off {msg.offset}</span>
                  <span className="obx-payload-txt">{msg.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   SagaAnim — Distributed Saga pattern:
   Step-by-step saga orchestration showing
   forward progress across microservices (T1 -> T2 -> T3)
   and compensating rollbacks (C2 -> C1) when T3
   encounters a business failure.
   ════════════════════════════════════════════ */
export type SagaStepState = "pending" | "running" | "success" | "failed" | "compensating" | "compensated";

export type SagaFrame = {
  activeStep: "T1" | "T2" | "T3" | "C2" | "C1" | "done";
  orderStatus: string;
  orderState: SagaStepState;
  paymentStatus: string;
  paymentState: SagaStepState;
  inventoryStatus: string;
  inventoryState: SagaStepState;
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

const DEFAULT_SAGA_FRAMES: SagaFrame[] = [
  {
    activeStep: "T1",
    orderStatus: "Creating Order #8401...",
    orderState: "running",
    paymentStatus: "Awaiting Order",
    paymentState: "pending",
    inventoryStatus: "Awaiting Order",
    inventoryState: "pending",
    note: "Saga Step 1 (T1): Order Service initiates saga, creates Order #8401 with status=PENDING.",
    beat: "neutral",
  },
  {
    activeStep: "T2",
    orderStatus: "Order Created (PENDING)",
    orderState: "success",
    paymentStatus: "Charging $180 via Card...",
    paymentState: "running",
    inventoryStatus: "Awaiting Payment",
    inventoryState: "pending",
    note: "Saga Step 2 (T2): Payment Service captures payment of $180.00 successfully.",
    beat: "neutral",
  },
  {
    activeStep: "T3",
    orderStatus: "Order Created (PENDING)",
    orderState: "success",
    paymentStatus: "Charged $180.00 (PAID)",
    paymentState: "success",
    inventoryStatus: "Reserving SKU #88... Out of Stock! (0 avail)",
    inventoryState: "failed",
    note: "Saga Step 3 (T3) FAILS: Inventory Service reports item is out of stock! Forward execution halts.",
    beat: "problem",
  },
  {
    activeStep: "C2",
    orderStatus: "Order Pending Rollback",
    orderState: "compensating",
    paymentStatus: "Refunding $180.00...",
    paymentState: "compensating",
    inventoryStatus: "Stock Reservation Failed",
    inventoryState: "failed",
    note: "Compensating Action (C2): Saga triggers reverse compensation. Payment Service refunds $180.00.",
    beat: "problem",
  },
  {
    activeStep: "C1",
    orderStatus: "Cancelling Order #8401...",
    orderState: "compensating",
    paymentStatus: "Refunded $180.00 (COMPENSATED)",
    paymentState: "compensated",
    inventoryStatus: "Stock Unavailable",
    inventoryState: "failed",
    note: "Compensating Action (C1): Order Service transitions Order status from PENDING to CANCELLED.",
    beat: "neutral",
  },
  {
    activeStep: "done",
    orderStatus: "Order CANCELLED (COMPENSATED)",
    orderState: "compensated",
    paymentStatus: "Refund Confirmed",
    paymentState: "compensated",
    inventoryStatus: "No Inventory Held",
    inventoryState: "compensated",
    note: "Saga Rollback Complete: All services back in consistent state without distributed 2PC locking.",
    beat: "solution",
  },
];

export function SagaAnim({
  title = "Distributed Saga: Forward Progress & Compensation",
  frames = DEFAULT_SAGA_FRAMES,
  caption,
}: {
  title?: string;
  frames?: SagaFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1900);
  const f = frames[st.cur] ?? frames[0];

  const steps: { id: "T1" | "T2" | "T3" | "C2" | "C1"; label: string; desc: string; type: "fwd" | "comp" }[] = [
    { id: "T1", label: "T1: Order", desc: "Create Order", type: "fwd" },
    { id: "T2", label: "T2: Payment", desc: "Charge Card", type: "fwd" },
    { id: "T3", label: "T3: Inventory", desc: "Reserve Stock", type: "fwd" },
    { id: "C2", label: "C2: Refund", desc: "Compensate Payment", type: "comp" },
    { id: "C1", label: "C1: Cancel", desc: "Compensate Order", type: "comp" },
  ];

  const getPose = (state: SagaStepState): GopherPose => {
    switch (state) {
      case "running":
      case "compensating":
        return "run";
      case "success":
        return "happy";
      case "failed":
        return "panic";
      case "compensated":
        return "idle";
      default:
        return "idle";
    }
  };

  const getGphState = (state: SagaStepState) => {
    switch (state) {
      case "running":
      case "compensating":
        return "active";
      case "success":
      case "compensated":
        return "ok";
      case "failed":
        return "bad";
      default:
        return "idle";
    }
  };

  return (
    <AnimShell
      title={title}
      kicker="saga pattern"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="sga">
        {/* Top Orchestrator timeline */}
        <div className="sga-timeline">
          <span className="sga-tl-label">Saga Execution Log:</span>
          <div className="sga-steps">
            {steps.map((s) => {
              const isCur = f.activeStep === s.id;
              const isDone =
                (s.id === "T1" && f.orderState !== "pending") ||
                (s.id === "T2" && f.paymentState !== "pending") ||
                (s.id === "T3" && f.inventoryState === "failed") ||
                (s.id === "C2" && f.paymentState === "compensated") ||
                (s.id === "C1" && f.orderState === "compensated");
              return (
                <div
                  key={s.id}
                  className={`sga-step-pill ${s.type} ${isCur ? "active" : isDone ? "done" : ""}`}
                >
                  <span className="sga-pill-code">{s.id}</span>
                  <span className="sga-pill-desc">{s.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3 Service Nodes */}
        <div className="sga-services">
          {/* Service 1: Order Service */}
          <div className={`sga-svc st-${f.orderState}`}>
            <div className="sga-svc-hdr">
              <span className="sga-svc-name">Order Service</span>
              <span className={`sga-badge ${f.orderState}`}>{f.orderState.toUpperCase()}</span>
            </div>
            <div className="sga-svc-body">
              <Gopher
                pose={getPose(f.orderState)}
                state={getGphState(f.orderState)}
                size={44}
                role="architect"
                title="Order Service"
              />
              <div className="sga-svc-info">
                <span className="sga-status-line">{f.orderStatus}</span>
                <span className="sga-db-sub">DB: orders table</span>
              </div>
            </div>
          </div>

          {/* Service 2: Payment Service */}
          <div className={`sga-svc st-${f.paymentState}`}>
            <div className="sga-svc-hdr">
              <span className="sga-svc-name">Payment Service</span>
              <span className={`sga-badge ${f.paymentState}`}>{f.paymentState.toUpperCase()}</span>
            </div>
            <div className="sga-svc-body">
              <Gopher
                pose={getPose(f.paymentState)}
                state={getGphState(f.paymentState)}
                size={44}
                role="banker"
                title="Payment Service"
              />
              <div className="sga-svc-info">
                <span className="sga-status-line">{f.paymentStatus}</span>
                <span className="sga-db-sub">Gateway: Stripe API</span>
              </div>
            </div>
          </div>

          {/* Service 3: Inventory Service */}
          <div className={`sga-svc st-${f.inventoryState}`}>
            <div className="sga-svc-hdr">
              <span className="sga-svc-name">Inventory Service</span>
              <span className={`sga-badge ${f.inventoryState}`}>{f.inventoryState.toUpperCase()}</span>
            </div>
            <div className="sga-svc-body">
              <Gopher
                pose={getPose(f.inventoryState)}
                state={getGphState(f.inventoryState)}
                size={44}
                role="librarian"
                title="Inventory Service"
              />
              <div className="sga-svc-info">
                <span className="sga-status-line">{f.inventoryStatus}</span>
                <span className="sga-db-sub">Warehouse Stock API</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RateLimitAnim — Traffic Rate Limiting:
   Token Bucket vs Leaky Bucket vs Sliding Window:
   Visualizing token drip, burst consumption, and
   429 Too Many Requests shedding.
   ════════════════════════════════════════════ */
export type RateLimitAlgorithm = "token-bucket" | "leaky-bucket" | "sliding-window";

export type RateLimitFrame = {
  algorithm?: RateLimitAlgorithm;
  bucketTokens?: number;
  bucketMax?: number;
  waterLevel?: number;
  waterMax?: number;
  windowCount?: number;
  windowLimit?: number;
  incomingReq?: { id: string; client: string; action: "allow" | "drop" | "idle" };
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

const DEFAULT_RATELIMIT_FRAMES: RateLimitFrame[] = [
  {
    algorithm: "token-bucket",
    bucketTokens: 5,
    bucketMax: 5,
    incomingReq: { id: "req-1", client: "client-1", action: "idle" },
    note: "Token Bucket: Capacity B=5 tokens. Refill rate r=+1 token/sec. Full bucket ready for traffic.",
    beat: "neutral",
  },
  {
    algorithm: "token-bucket",
    bucketTokens: 4,
    bucketMax: 5,
    incomingReq: { id: "GET /checkout", client: "client-1", action: "allow" },
    note: "Request 1 arrives -> Consumes 1 token -> 200 OK (Allowed). 4 tokens remaining.",
    beat: "solution",
  },
  {
    algorithm: "token-bucket",
    bucketTokens: 1,
    bucketMax: 5,
    incomingReq: { id: "Burst [3 reqs]", client: "client-2", action: "allow" },
    note: "Traffic burst (3 concurrent requests) -> 3 tokens consumed simultaneously -> 200 OK. 1 token left.",
    beat: "neutral",
  },
  {
    algorithm: "token-bucket",
    bucketTokens: 0,
    bucketMax: 5,
    incomingReq: { id: "GET /profile", client: "client-3", action: "allow" },
    note: "Request 5 arrives -> Consumes last token -> 200 OK. Bucket is now completely EMPTY (0 tokens).",
    beat: "neutral",
  },
  {
    algorithm: "token-bucket",
    bucketTokens: 0,
    bucketMax: 5,
    incomingReq: { id: "GET /search", client: "client-4", action: "drop" },
    note: "Request 6 arrives with 0 tokens available -> 429 Too Many Requests (SHED)! Backend protected.",
    beat: "problem",
  },
  {
    algorithm: "token-bucket",
    bucketTokens: 2,
    bucketMax: 5,
    incomingReq: { id: "GET /api/v2", client: "client-1", action: "allow" },
    note: "Ticker refuels +2 tokens -> Next request consumes 1 token -> 200 OK. Normal operation resumed.",
    beat: "solution",
  },
];

export function RateLimitAnim({
  title = "Rate Limiting: Token Bucket & Traffic Shedding",
  algorithm = "token-bucket",
  frames = DEFAULT_RATELIMIT_FRAMES,
  caption,
}: {
  title?: string;
  algorithm?: RateLimitAlgorithm;
  frames?: RateLimitFrame[];
  caption?: string;
}) {
  const [algo] = useState<RateLimitAlgorithm>(algorithm);
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];

  const tokens = f.bucketTokens ?? 0;
  const maxTokens = f.bucketMax ?? 5;
  const isDropped = f.incomingReq?.action === "drop";
  const isAllowed = f.incomingReq?.action === "allow";

  return (
    <AnimShell
      title={title}
      kicker="rate limiter"
      note={f.note}
      beat={f.beat ?? (isDropped ? "problem" : isAllowed ? "solution" : "neutral")}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="rtb">
        {/* Incoming Traffic Side */}
        <div className="rtb-client">
          <Gopher
            pose={isDropped ? "blocked" : isAllowed ? "run" : "idle"}
            state={isDropped ? "warn" : isAllowed ? "active" : "idle"}
            size={46}
            role="pilot"
            title="Ingress Traffic"
          />
          <span className="rtb-name">Ingress Traffic</span>
          {f.incomingReq && f.incomingReq.action !== "idle" && (
            <div className={`rtb-req-packet ${f.incomingReq.action}`}>
              <span className="rtb-req-id">{f.incomingReq.id}</span>
              <span className={`rtb-verdict ${f.incomingReq.action}`}>
                {f.incomingReq.action === "allow" ? "✓ 200 ALLOWED" : "✕ 429 SHED"}
              </span>
            </div>
          )}
        </div>

        {/* Center: Token Bucket Container */}
        <div className={`rtb-bucket-wrap ${isDropped ? "rtb-shed" : ""}`}>
          <div className="rtb-faucet">
            <span className="rtb-drip">💧</span>
            <span className="rtb-rate">+1 token/sec</span>
          </div>

          <div className="rtb-bucket">
            <div className="rtb-bucket-hdr">
              <span className="rtb-b-label">Token Bucket</span>
              <span className="rtb-b-count">{tokens} / {maxTokens} tokens</span>
            </div>

            <div className="rtb-tokens-grid">
              {Array.from({ length: maxTokens }, (_, i) => {
                const filled = i < tokens;
                return (
                  <div key={i} className={`rtb-token ${filled ? "filled" : "empty"}`}>
                    {filled ? "🟡" : "○"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Protected Downstream Service */}
        <div className="rtb-backend">
          <Gopher
            pose={isDropped ? "idle" : isAllowed ? "happy" : "idle"}
            state={isDropped ? "idle" : isAllowed ? "ok" : "idle"}
            size={46}
            role="medic"
            title="Backend Service"
          />
          <span className="rtb-name">Protected Backend</span>
          <span className={`rtb-load-badge ${isDropped ? "safe" : isAllowed ? "load" : "idle"}`}>
            {isDropped ? "Load Protected (0 impact)" : isAllowed ? "Processing Request" : "Capacity OK"}
          </span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ActorAnim — Goroutine Actor Pattern:
   Isolated actor owning private state, FIFO
   inbox channel, sequential single-threaded
   execution, and private response channels.
   ════════════════════════════════════════════ */
export type ActorEnvelope = {
  from: string;
  cmd: string;
  replyChan: string;
};

export type ActorFrame = {
  clients: { name: string; action: "idle" | "send" | "await" | "received"; role?: GopherRole }[];
  mailbox: ActorEnvelope[];
  processing?: ActorEnvelope | null;
  actorState: Record<string, string | number>;
  activeReply?: { to: string; val: string } | null;
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

const DEFAULT_ACTOR_FRAMES: ActorFrame[] = [
  {
    clients: [
      { name: "Client A", action: "idle", role: "worker" },
      { name: "Client B", action: "idle", role: "banker" },
    ],
    mailbox: [],
    processing: null,
    actorState: { Balance: "$100", OpCount: 0 },
    activeReply: null,
    note: "Actor Goroutine initialized with private state (Balance=$100). Listening on FIFO inbox channel.",
    beat: "neutral",
  },
  {
    clients: [
      { name: "Client A", action: "send", role: "worker" },
      { name: "Client B", action: "send", role: "banker" },
    ],
    mailbox: [
      { from: "Client A", cmd: "Deposit $50", replyChan: "ch_A" },
      { from: "Client B", cmd: "Withdraw $30", replyChan: "ch_B" },
    ],
    processing: null,
    actorState: { Balance: "$100", OpCount: 0 },
    activeReply: null,
    note: "Clients concurrently send commands with private reply channels. Messages serialize in inbox FIFO.",
    beat: "neutral",
  },
  {
    clients: [
      { name: "Client A", action: "await", role: "worker" },
      { name: "Client B", action: "await", role: "banker" },
    ],
    mailbox: [{ from: "Client B", cmd: "Withdraw $30", replyChan: "ch_B" }],
    processing: { from: "Client A", cmd: "Deposit $50", replyChan: "ch_A" },
    actorState: { Balance: "$150", OpCount: 1 },
    activeReply: null,
    note: "Actor pops Client A's command, mutates private Balance to $150. No mutex lock needed!",
    beat: "solution",
  },
  {
    clients: [
      { name: "Client A", action: "received", role: "worker" },
      { name: "Client B", action: "await", role: "banker" },
    ],
    mailbox: [{ from: "Client B", cmd: "Withdraw $30", replyChan: "ch_B" }],
    processing: null,
    actorState: { Balance: "$150", OpCount: 1 },
    activeReply: { to: "Client A", val: "OK: Balance=$150" },
    note: "Actor replies on ch_A. Client A unblocks with updated balance.",
    beat: "solution",
  },
  {
    clients: [
      { name: "Client A", action: "idle", role: "worker" },
      { name: "Client B", action: "await", role: "banker" },
    ],
    mailbox: [],
    processing: { from: "Client B", cmd: "Withdraw $30", replyChan: "ch_B" },
    actorState: { Balance: "$120", OpCount: 2 },
    activeReply: null,
    note: "Actor pops Client B's command, mutates Balance to $120. Sequential, lock-free safety guaranteed.",
    beat: "solution",
  },
  {
    clients: [
      { name: "Client A", action: "idle", role: "worker" },
      { name: "Client B", action: "received", role: "banker" },
    ],
    mailbox: [],
    processing: null,
    actorState: { Balance: "$120", OpCount: 2 },
    activeReply: { to: "Client B", val: "OK: Balance=$120" },
    note: "Actor replies on ch_B. Both client requests executed sequentially with zero race conditions.",
    beat: "solution",
  },
];

export function ActorAnim({
  title = "Goroutine Actor: Private State & Lock-Free Channel Mailbox",
  frames = DEFAULT_ACTOR_FRAMES,
  caption,
}: {
  title?: string;
  frames?: ActorFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1800);
  const f = frames[st.cur] ?? frames[0];

  return (
    <AnimShell
      title={title}
      kicker="actor pattern"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="act">
        {/* Left: Client Goroutines */}
        <div className="act-clients">
          <span className="act-sec-title">Concurrent Clients</span>
          {f.clients.map((c) => (
            <div key={c.name} className={`act-client-card ${c.action}`}>
              <Gopher
                pose={c.action === "send" ? "carry" : c.action === "received" ? "happy" : c.action === "await" ? "blocked" : "idle"}
                state={c.action === "received" ? "ok" : c.action === "await" ? "warn" : c.action === "send" ? "active" : "idle"}
                size={40}
                role={c.role ?? "worker"}
                title={c.name}
              />
              <div className="act-client-meta">
                <span className="act-client-name">{c.name}</span>
                <span className={`act-client-pill ${c.action}`}>{c.action.toUpperCase()}</span>
                {f.activeReply?.to === c.name && (
                  <span className="act-reply-badge">↩ {f.activeReply.val}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Center: Inbox FIFO Channel */}
        <div className="act-channel">
          <div className="act-chan-hdr">
            <span className="act-tag">inbox chan Envelope</span>
            <span className="act-chan-cap">FIFO Queue</span>
          </div>

          <div className="act-chan-pipe">
            {f.mailbox.length === 0 && !f.processing && (
              <span className="act-chan-empty">Channel empty (Awaiting messages)</span>
            )}
            {f.mailbox.map((env, i) => (
              <div key={i} className="act-envelope">
                <span className="act-env-from">{env.from}</span>
                <span className="act-env-cmd">{env.cmd}</span>
                <span className="act-env-reply">reply: {env.replyChan}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Actor Execution Chamber */}
        <div className="act-chamber">
          <div className="act-chamber-hdr">
            <span className="act-chamber-title">Actor Goroutine</span>
            <span className="act-lockfree-badge">100% Lock-Free</span>
          </div>

          <div className="act-chamber-body">
            <Gopher
              pose={f.processing ? "run" : "idle"}
              state={f.processing ? "active" : "ok"}
              size={48}
              role="alchemist"
              title="Actor Goroutine"
            />
            {f.processing && (
              <div className="act-current-op">
                <span className="act-op-label">Processing:</span>
                <span className="act-op-val">{f.processing.cmd} (from {f.processing.from})</span>
              </div>
            )}
          </div>

          <div className="act-state-reg">
            <div className="act-reg-title">Private Internal State:</div>
            <div className="act-reg-fields">
              {Object.entries(f.actorState).map(([k, v]) => (
                <div key={k} className="act-reg-row">
                  <span className="act-reg-k">{k}:</span>
                  <span className="act-reg-v">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LocksmithAnim — Distributed Locking & Fencing:
   Visualizing Redis/etcd distributed lock leases,
   heartbeat renewals, GC pauses / partitions,
   and monotonic fencing token validation at storage.
   ════════════════════════════════════════════ */
export type LocksmithFrame = {
  worker1: { state: "holding" | "paused" | "stale_write" | "rejected" | "idle"; token?: number };
  worker2: { state: "idle" | "waiting" | "acquired" | "active_write" | "success"; token?: number };
  coordinator: { holder: string | null; ttlSeconds: number; maxTtl: number; currentFencingToken: number };
  storage: { highestSeenToken: number; lastWriteStatus: "none" | "success" | "rejected"; lastWriteMsg?: string };
  networkPartition?: boolean;
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

const DEFAULT_LOCKSMITH_FRAMES: LocksmithFrame[] = [
  {
    worker1: { state: "holding", token: 41 },
    worker2: { state: "waiting" },
    coordinator: { holder: "Worker 1", ttlSeconds: 10, maxTtl: 10, currentFencingToken: 41 },
    storage: { highestSeenToken: 40, lastWriteStatus: "none" },
    networkPartition: false,
    note: "Worker 1 acquires lock on Redis/etcd with 10s lease and monotonic Fencing Token #41.",
    beat: "neutral",
  },
  {
    worker1: { state: "paused", token: 41 },
    worker2: { state: "waiting" },
    coordinator: { holder: "Worker 1", ttlSeconds: 2, maxTtl: 10, currentFencingToken: 41 },
    storage: { highestSeenToken: 40, lastWriteStatus: "none" },
    networkPartition: true,
    note: "Worker 1 suffers long GC Stop-The-World pause / network split! Lease heartbeat stops.",
    beat: "problem",
  },
  {
    worker1: { state: "paused", token: 41 },
    worker2: { state: "acquired", token: 42 },
    coordinator: { holder: "Worker 2", ttlSeconds: 10, maxTtl: 10, currentFencingToken: 42 },
    storage: { highestSeenToken: 40, lastWriteStatus: "none" },
    networkPartition: true,
    note: "Lease expires! Coordinator grants lock to Worker 2 with incremented Fencing Token #42.",
    beat: "neutral",
  },
  {
    worker1: { state: "paused", token: 41 },
    worker2: { state: "active_write", token: 42 },
    coordinator: { holder: "Worker 2", ttlSeconds: 8, maxTtl: 10, currentFencingToken: 42 },
    storage: {
      highestSeenToken: 42,
      lastWriteStatus: "success",
      lastWriteMsg: "Worker 2 write accepted (Token 42 >= HighestSeen 40)",
    },
    networkPartition: true,
    note: "Worker 2 writes to Storage with Token #42. Storage records Highest Token = 42. Success!",
    beat: "solution",
  },
  {
    worker1: { state: "stale_write", token: 41 },
    worker2: { state: "success", token: 42 },
    coordinator: { holder: "Worker 2", ttlSeconds: 6, maxTtl: 10, currentFencingToken: 42 },
    storage: {
      highestSeenToken: 42,
      lastWriteStatus: "rejected",
      lastWriteMsg: "REJECTED: Stale Token #41 < HighestSeen #42! Corruption Prevented!",
    },
    networkPartition: false,
    note: "Worker 1 wakes up (unaware its lease expired!), sends write with Token #41 -> Storage REJECTS stale write!",
    beat: "problem",
  },
  {
    worker1: { state: "rejected", token: 41 },
    worker2: { state: "success", token: 42 },
    coordinator: { holder: "Worker 2", ttlSeconds: 5, maxTtl: 10, currentFencingToken: 42 },
    storage: {
      highestSeenToken: 42,
      lastWriteStatus: "success",
      lastWriteMsg: "Data integrity preserved by monotonic fencing token validation",
    },
    networkPartition: false,
    note: "Fencing tokens ensure correctness even during GC pauses, network partitions, and clock skew.",
    beat: "solution",
  },
];

export function LocksmithAnim({
  title = "Distributed Locking: TTL Leases & Monotonic Fencing Tokens",
  frames = DEFAULT_LOCKSMITH_FRAMES,
  caption,
}: {
  title?: string;
  frames?: LocksmithFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1900);
  const f = frames[st.cur] ?? frames[0];

  const w1Pose: GopherPose =
    f.worker1.state === "paused"
      ? "sleep"
      : f.worker1.state === "rejected"
      ? "panic"
      : f.worker1.state === "holding" || f.worker1.state === "stale_write"
      ? "run"
      : "idle";

  const w2Pose: GopherPose =
    f.worker2.state === "success"
      ? "happy"
      : f.worker2.state === "acquired" || f.worker2.state === "active_write"
      ? "run"
      : f.worker2.state === "waiting"
      ? "blocked"
      : "idle";

  const ttlPct = Math.max(0, Math.min(100, (f.coordinator.ttlSeconds / (f.coordinator.maxTtl || 10)) * 100));

  return (
    <AnimShell
      title={title}
      kicker="distributed locks"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="lks">
        {/* Top: Two Distributed Workers */}
        <div className="lks-workers">
          {/* Worker 1 */}
          <div className={`lks-worker st-${f.worker1.state}`}>
            <div className="lks-worker-hdr">
              <span className="lks-w-title">Worker 1</span>
              {f.worker1.token && <span className="lks-token-pill">Token #{f.worker1.token}</span>}
            </div>
            <div className="lks-worker-body">
              <Gopher
                pose={w1Pose}
                state={f.worker1.state === "rejected" ? "bad" : f.worker1.state === "holding" ? "active" : "idle"}
                size={44}
                role="locksmith"
                title="Worker 1"
              />
              <div className="lks-worker-status">
                <span className={`lks-state-tag tag-${f.worker1.state}`}>
                  {f.worker1.state === "holding"
                    ? "HOLDING LOCK"
                    : f.worker1.state === "paused"
                    ? "GC PAUSED (FROZEN)"
                    : f.worker1.state === "stale_write"
                    ? "SENDING WRITE (STALE)"
                    : f.worker1.state === "rejected"
                    ? "WRITE REJECTED"
                    : "IDLE"}
                </span>
              </div>
            </div>
          </div>

          {/* Partition indicator */}
          {f.networkPartition && (
            <div className="lks-partition-indicator">
              <span className="lks-split-icon">⚡</span>
              <span className="lks-split-text">Network Partition / GC Delay</span>
            </div>
          )}

          {/* Worker 2 */}
          <div className={`lks-worker st-${f.worker2.state}`}>
            <div className="lks-worker-hdr">
              <span className="lks-w-title">Worker 2</span>
              {f.worker2.token && <span className="lks-token-pill">Token #{f.worker2.token}</span>}
            </div>
            <div className="lks-worker-body">
              <Gopher
                pose={w2Pose}
                state={f.worker2.state === "success" ? "ok" : f.worker2.state === "acquired" || f.worker2.state === "active_write" ? "active" : "idle"}
                size={44}
                role="locksmith"
                title="Worker 2"
              />
              <div className="lks-worker-status">
                <span className={`lks-state-tag tag-${f.worker2.state}`}>
                  {f.worker2.state === "acquired"
                    ? "ACQUIRED LOCK"
                    : f.worker2.state === "active_write"
                    ? "WRITING WITH TOKEN 42"
                    : f.worker2.state === "success"
                    ? "WRITE ACCEPTED"
                    : f.worker2.state === "waiting"
                    ? "WAITING FOR LOCK"
                    : "IDLE"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Distributed Lock Coordinator (Redis/etcd) */}
        <div className="lks-coord">
          <div className="lks-coord-hdr">
            <span className="lks-coord-title">Distributed Lock Manager (Redis / etcd)</span>
            <span className="lks-fencing-badge">Monotonic Token: #{f.coordinator.currentFencingToken}</span>
          </div>

          <div className="lks-coord-body">
            <div className="lks-coord-field">
              <span className="lks-k">Resource:</span>
              <span className="lks-v">lock/user-account-99</span>
            </div>
            <div className="lks-coord-field">
              <span className="lks-k">Current Owner:</span>
              <span className="lks-v-owner">{f.coordinator.holder ?? "NONE (Free)"}</span>
            </div>
            <div className="lks-coord-ttl">
              <div className="lks-ttl-hdr">
                <span className="lks-k">Lease TTL:</span>
                <span className="lks-v">{f.coordinator.ttlSeconds}s remaining</span>
              </div>
              <div className="lks-ttl-track">
                <div
                  className={`lks-ttl-fill ${ttlPct < 30 ? "low" : ""}`}
                  style={{ width: `${ttlPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Storage / Resource Validation */}
        <div className={`lks-storage st-${f.storage.lastWriteStatus}`}>
          <div className="lks-storage-hdr">
            <span className="lks-storage-title">Storage / Database (Fencing Guard)</span>
            <span className="lks-high-watermark">Highest Seen Token = {f.storage.highestSeenToken}</span>
          </div>

          <div className="lks-storage-body">
            <div className="lks-rule-box">
              <code>rule: Write is ACCEPTED only if token &gt;= HighestSeenToken</code>
            </div>
            {f.storage.lastWriteMsg && (
              <div className={`lks-write-result ${f.storage.lastWriteStatus}`}>
                {f.storage.lastWriteStatus === "rejected" ? "✕ " : "✓ "}
                {f.storage.lastWriteMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LinkedListAnim — Visualizes linked list nodes,
   memory pointers, and traversal algorithms
   (Reversal, Fast & Slow Tortoise/Hare, Merge).
   ════════════════════════════════════════════ */
export type LLNode = {
  id: string;
  val: string | number;
  nextId?: string | null;
  state?: "idle" | "active" | "target" | "done" | "deleted";
};

export type LLFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  nodes: LLNode[];
  /** Pointer labels attached to node IDs, e.g. { head: "n1", prev: "n1", cur: "n2", fast: "n3" } */
  pointers?: Record<string, string>;
  /** Highlighted connection, e.g. ["n1-n2"] */
  links?: { from: string; to: string | "nil"; dir?: "forward" | "backward" | "broken" }[];
};

export function LinkedListAnim({
  title = "Linked List Traversal",
  frames,
  caption,
}: {
  title?: string;
  frames: LLFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];

  return (
    <AnimShell
      title={title}
      kicker="linked list"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="dsa-ll-stage">
        <div className="dsa-ll-track">
          {f.nodes.map((node, i) => {
            const pointersHere = Object.entries(f.pointers || {})
              .filter(([_, nodeId]) => nodeId === node.id)
              .map(([ptr]) => ptr);

            const isLast = i === f.nodes.length - 1;
            const link = f.links?.find((l) => l.from === node.id);

            return (
              <div key={node.id} className={`dsa-ll-node-wrap st-${node.state || "idle"}`}>
                {/* Pointer Flags above node */}
                <div className="dsa-ll-pointers-bar">
                  {pointersHere.map((ptr) => (
                    <span key={ptr} className={`dsa-ll-ptr-tag ptr-${ptr}`}>
                      {ptr}
                      <span className="dsa-ll-ptr-arrow">↓</span>
                    </span>
                  ))}
                </div>

                {/* Node Box */}
                <div className="dsa-ll-node">
                  <div className="dsa-ll-val">{node.val}</div>
                  <div className="dsa-ll-next-dot" title={`Next pointer: ${node.nextId ?? "nil"}`}>
                    •
                  </div>
                </div>

                {/* Arrow to Next Node or NIL */}
                <div className={`dsa-ll-edge ${link?.dir || "forward"}`}>
                  {link?.dir === "backward" ? (
                    <span className="dsa-ll-arrow backward">←</span>
                  ) : link?.dir === "broken" ? (
                    <span className="dsa-ll-arrow broken">✕</span>
                  ) : (
                    <span className="dsa-ll-arrow forward">→</span>
                  )}
                  {isLast && !link && <span className="dsa-ll-nil-tag">nil</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   TreeAnim — Visualizes Binary Trees & BSTs,
   in-order traversal, search, and balancing.
   ════════════════════════════════════════════ */
export type TreeNode = {
  id: string;
  val: string | number;
  left?: string;
  right?: string;
  x: number;
  y: number;
};

export type TreeFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  nodeStates: Record<string, "idle" | "visited" | "current" | "found" | "insert">;
  /** Active path edges, e.g. ["root-left", "left-right"] */
  highlightEdges?: string[];
  gopherAt?: string;
};

export function TreeAnim({
  title = "Binary Tree Traversal",
  nodes,
  height = 240,
  frames,
  caption,
}: {
  title?: string;
  nodes: TreeNode[];
  height?: number;
  frames: TreeFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];
  const posMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const at = f.gopherAt ? posMap[f.gopherAt] : null;
  const litEdges = new Set(f.highlightEdges || []);

  return (
    <AnimShell
      title={title}
      kicker="binary tree"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="dsa-tree-stage">
        <svg className="dsa-tree-svg" viewBox={`0 0 460 ${height}`}>
          {/* Tree branch lines */}
          {nodes.map((n) => {
            const leftNode = n.left ? posMap[n.left] : null;
            const rightNode = n.right ? posMap[n.right] : null;
            return (
              <Fragment key={n.id}>
                {leftNode && (
                  <line
                    x1={n.x}
                    y1={n.y}
                    x2={leftNode.x}
                    y2={leftNode.y}
                    className={`dsa-tree-edge ${
                      litEdges.has(`${n.id}-${leftNode.id}`) ? "lit" : ""
                    }`}
                  />
                )}
                {rightNode && (
                  <line
                    x1={n.x}
                    y1={n.y}
                    x2={rightNode.x}
                    y2={rightNode.y}
                    className={`dsa-tree-edge ${
                      litEdges.has(`${n.id}-${rightNode.id}`) ? "lit" : ""
                    }`}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Tree Nodes */}
          {nodes.map((n) => {
            const s = f.nodeStates[n.id] || "idle";
            return (
              <g key={n.id} className={`dsa-tree-node st-${s}`}>
                <circle cx={n.x} cy={n.y} r="18" className="dsa-tree-circle" />
                <text x={n.x} y={n.y + 5} textAnchor="middle" className="dsa-tree-text">
                  {n.val}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Mascot Walker */}
        {at && (
          <span
            className="dsa-tree-walker"
            style={{
              left: `${(at.x / 460) * 100}%`,
              top: `${(at.y / height) * 100}%`,
            } as CSSProperties}
          >
            <Gopher pose="run" state="active" size={32} role="scientist" title="Tree Explorer" />
          </span>
        )}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   StackQueueAnim — Visualizes LIFO Stack and
   FIFO Queue push/pop operations.
   ════════════════════════════════════════════ */
export type StackQueueFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  items: (string | number)[];
  action: "push" | "pop" | "enqueue" | "dequeue" | "peek" | "idle";
  actionItem?: string | number;
};

export function StackQueueAnim({
  title = "Stack & Queue Mechanics",
  type = "stack",
  frames,
  caption,
}: {
  title?: string;
  type?: "stack" | "queue";
  frames: StackQueueFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1600);
  const f = frames[st.cur] ?? frames[0];

  return (
    <AnimShell
      title={title}
      kicker={type === "stack" ? "LIFO STACK" : "FIFO QUEUE"}
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className={`dsa-sq-stage type-${type}`}>
        <div className="dsa-sq-action-bar">
          <span className={`dsa-sq-op-tag op-${f.action}`}>
            {f.action.toUpperCase()} {f.actionItem !== undefined ? `(${f.actionItem})` : ""}
          </span>
        </div>

        <div className="dsa-sq-container">
          {type === "stack" ? (
            <div className="dsa-stack-chamber">
              <div className="dsa-stack-top-label">TOP (Push / Pop) ↓</div>
              <div className="dsa-stack-items">
                {f.items.length === 0 ? (
                  <div className="dsa-sq-empty">Empty Stack</div>
                ) : (
                  f.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`dsa-sq-item ${
                        idx === 0 && (f.action === "push" || f.action === "peek") ? "hot" : ""
                      }`}
                    >
                      <span className="dsa-sq-idx">[{idx}]</span>
                      <span className="dsa-sq-val">{item}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="dsa-queue-pipe">
              <div className="dsa-queue-head-label">← DEQUEUE (Head)</div>
              <div className="dsa-queue-items">
                {f.items.length === 0 ? (
                  <div className="dsa-sq-empty">Empty Queue</div>
                ) : (
                  f.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`dsa-sq-item ${
                        idx === 0 && f.action === "dequeue" ? "hot" : ""
                      }`}
                    >
                      <span className="dsa-sq-val">{item}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="dsa-queue-tail-label">ENQUEUE (Tail) ←</div>
            </div>
          )}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   SlidingWindowAnim — Visualizes Two Pointers,
   window expansion, and condition contraction.
   ════════════════════════════════════════════ */
export type SlidingWindowFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  array: (string | number)[];
  left: number;
  right: number;
  status: "expanding" | "valid" | "invalid_shrinking" | "found_max";
  metricLabel?: string;
  metricValue?: string | number;
};

export function SlidingWindowAnim({
  title = "Sliding Window Algorithm",
  frames,
  caption,
}: {
  title?: string;
  frames: SlidingWindowFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];

  return (
    <AnimShell
      title={title}
      kicker="sliding window"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="dsa-sw-stage">
        {/* Metric Bar */}
        {f.metricLabel && (
          <div className="dsa-sw-metric-bar">
            <span className="dsa-sw-m-label">{f.metricLabel}:</span>
            <span className="dsa-sw-m-val">{f.metricValue}</span>
            <span className={`dsa-sw-status-tag st-${f.status}`}>
              {f.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
        )}

        {/* Array with pointers */}
        <div className="dsa-sw-array-row">
          {f.array.map((val, idx) => {
            const inWindow = idx >= f.left && idx <= f.right;
            const isLeft = idx === f.left;
            const isRight = idx === f.right;

            return (
              <div key={idx} className={`dsa-sw-cell-wrap ${inWindow ? "in-window" : ""}`}>
                {/* Pointer tags */}
                <div className="dsa-sw-ptr-slot">
                  {isLeft && <span className="dsa-sw-ptr-tag ptr-l">L</span>}
                  {isRight && <span className="dsa-sw-ptr-tag ptr-r">R</span>}
                </div>

                {/* Array cell */}
                <div className={`dsa-sw-cell ${inWindow ? "window-active" : ""}`}>
                  <span className="dsa-sw-cell-val">{val}</span>
                  <span className="dsa-sw-cell-idx">{idx}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   DPTableAnim — Visualizes Dynamic Programming
   memoization grids and recurrence formulas.
   ════════════════════════════════════════════ */
export type DPTableFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  grid: (string | number)[][];
  rowLabels: string[];
  colLabels: string[];
  activeCell?: { r: number; c: number };
  dependencyCells?: { r: number; c: number }[];
  formula?: string;
};

export function DPTableAnim({
  title = "DP Memoization Table",
  frames,
  caption,
}: {
  title?: string;
  frames: DPTableFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1700);
  const f = frames[st.cur] ?? frames[0];

  return (
    <AnimShell
      title={title}
      kicker="dynamic programming"
      note={f.note}
      beat={f.beat ?? "neutral"}
      cur={st.cur}
      total={frames.length}
      playing={st.playing}
      speed={st.speed}
      onSpeed={st.cycleSpeed}
      onReset={st.reset}
      onStep={st.step}
      onToggle={st.toggle}
      onGo={st.go}
      caption={caption}
    >
      <div className="dsa-dp-stage">
        {f.formula && (
          <div className="dsa-dp-formula-bar">
            <span className="dsa-dp-f-label">Recurrence:</span>
            <code>{f.formula}</code>
          </div>
        )}

        <div className="dsa-dp-grid-wrap">
          <table className="dsa-dp-table">
            <thead>
              <tr>
                <th className="dsa-dp-corner" />
                {f.colLabels.map((col, idx) => (
                  <th key={idx} className="dsa-dp-col-hdr">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.grid.map((row, rIdx) => (
                <tr key={rIdx}>
                  <th className="dsa-dp-row-hdr">{f.rowLabels[rIdx]}</th>
                  {row.map((cell, cIdx) => {
                    const isActive = f.activeCell?.r === rIdx && f.activeCell?.c === cIdx;
                    const isDep = f.dependencyCells?.some(
                      (d) => d.r === rIdx && d.c === cIdx
                    );
                    return (
                      <td
                        key={cIdx}
                        className={`dsa-dp-cell ${isActive ? "cell-active" : ""} ${
                          isDep ? "cell-dep" : ""
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AnimShell>
  );
}


