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
                    {/* The full name is in the tag below; inside the 15px circle only a
                        short id fits. Longer ids got clipped ("domain" → "omai"). */}
                    {n.id.length <= 3 ? (
                      <text x={n.x} y={n.y + 4} textAnchor="middle" className="grf-node-id">
                        {n.id}
                      </text>
                    ) : (
                      <circle cx={n.x} cy={n.y} r="4" className="grf-node-dot" />
                    )}
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



/* ════════════════════════════════════════════
   InterfaceAnim — an interface variable drawn as
   what it IS: a box with two slots, TYPE and VALUE.
   Each frame runs one line of code; the slots fill
   (or stay empty) and a detective gopher reads the
   `== nil` verdict, which is true ONLY when both
   slots are empty. Built for the typed-nil trap:
   watch the type slot fill while the value is nil.
   ════════════════════════════════════════════ */
type IfaceFrame = {
  code: string; // the line being executed this frame
  note: string;
  beat?: "problem" | "solution" | "neutral";
  type: string | null; // dynamic type slot (null = empty)
  value: string | null; // dynamic value slot (null = empty)
  ptr?: { name: string; value: string }; // optional plain pointer var shown beside the box
};

export function InterfaceAnim({
  title = "Inside an interface value",
  name = "err",
  iface = "error",
  frames,
  caption,
}: {
  title?: string;
  name?: string;
  iface?: string;
  frames: IfaceFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  const isNil = f.type === null && f.value === null;
  const trap = f.type !== null && (f.value === null || f.value === "nil");
  return (
    <AnimShell
      title={title}
      kicker="interface value"
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
      <div className="ifa">
        <code key={`c${st.cur}`} className="ifa-code">{f.code}</code>
        <div className="ifa-row">
          {f.ptr && (
            <div className="ifa-ptr">
              <span className="ifa-name">{f.ptr.name}</span>
              <span key={f.ptr.value} className={`ifa-cell ${f.ptr.value === "nil" ? "nil" : "full"}`}>{f.ptr.value}</span>
              <span className={`ifa-verdict ${f.ptr.value === "nil" ? "yes" : "no"}`}>
                {f.ptr.name} == nil → {f.ptr.value === "nil" ? "true" : "false"}
              </span>
            </div>
          )}
          <div className="ifa-var">
            <span className="ifa-name">
              {name} <em>({iface})</em>
            </span>
            <div className={`ifa-box ${trap ? "trap" : ""}`}>
              <div className="ifa-slot">
                <span className="ifa-lbl">type</span>
                <span key={`t${f.type}`} className={`ifa-cell ${f.type === null ? "empty" : "full"}`}>{f.type ?? "—"}</span>
              </div>
              <div className="ifa-slot">
                <span className="ifa-lbl">value</span>
                <span key={`v${f.value}`} className={`ifa-cell ${f.value === null ? "empty" : f.value === "nil" ? "nil" : "full"}`}>{f.value ?? "—"}</span>
              </div>
            </div>
            <span className={`ifa-verdict ${isNil ? "yes" : trap ? "trap" : "no"}`}>
              {name} == nil → {isNil ? "true" : "false"}
            </span>
          </div>
          <span className="ifa-gopher">
            <Gopher
              pose={trap ? "panic" : isNil ? "idle" : "happy"}
              state={trap ? "bad" : isNil ? "idle" : "ok"}
              size={40}
              role="detective"
              title="nil inspector"
            />
          </span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   IsolationAnim — a container is one process seen
   two ways. Left column: what the HOST sees. Right
   column: what the process INSIDE sees. Each row is
   one thing a namespace can virtualize (hostname,
   PIDs, filesystem, mounts…). When a frame switches
   a namespace on, that row's two values split apart
   and a wall drops between them.
   ════════════════════════════════════════════ */
type IsoRow = { label: string; host: string; inside: string; ns?: string };
type IsoFrame = {
  code?: string;
  note: string;
  beat?: "problem" | "solution" | "neutral";
  rows: IsoRow[];
};

export function IsolationAnim({
  title = "One process, two views",
  frames,
  caption,
}: {
  title?: string;
  frames: IsoFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2300);
  const f = frames[st.cur] ?? frames[0];
  const walled = f.rows.filter((r) => r.host !== r.inside).length;
  return (
    <AnimShell
      title={title}
      kicker="namespaces"
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
      <div className="iso">
        {f.code && <code key={`c${st.cur}`} className="iso-code">{f.code}</code>}
        <div className="iso-grid">
          <span className="iso-head">
            <Gopher pose="idle" state="idle" size={30} role="operator" title="host" /> host sees
          </span>
          <span />
          <span className="iso-head">
            <Gopher pose={walled ? "happy" : "idle"} state={walled ? "ok" : "idle"} size={30} role="captain" title="container" /> inside sees
          </span>
          {f.rows.map((r) => {
            const split = r.host !== r.inside;
            return (
              <Fragment key={r.label}>
                <span className="iso-cell">
                  <span className="iso-lbl">{r.label}</span>
                  <span className="iso-val">{r.host}</span>
                </span>
                <span className={`iso-wall ${split ? "up" : ""}`} title={r.ns}>
                  {split && <span className="iso-ns">{r.ns}</span>}
                </span>
                <span className={`iso-cell ${split ? "split" : "shared"}`}>
                  <span className="iso-lbl">{r.label}</span>
                  <span key={r.inside} className="iso-val">{r.inside}</span>
                </span>
              </Fragment>
            );
          })}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   CgroupAnim — cgroup limits drawn as meters. Each
   meter is one controller file (memory.max,
   pids.max, cpu.max). Usage bars grow frame by
   frame; hitting the limit turns the bar red and
   the kernel gopher acts: OOM-kill or refuse fork.
   ════════════════════════════════════════════ */
type CgMeter = { label: string; used: number; limit: number; unit?: string };
type CgFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  meters: CgMeter[];
  event?: string; // e.g. "OOM kill: tail (exit 137)"
};

export function CgroupAnim({
  title = "cgroup limits, enforced by the kernel",
  frames,
  caption,
}: {
  title?: string;
  frames: CgFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2000);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="cgroups"
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
      <div className="cgr">
        <div className="cgr-meters">
          {f.meters.map((m) => {
            const pct = Math.min(100, (m.used / m.limit) * 100);
            const lvl = pct >= 100 ? "full" : pct >= 75 ? "hot" : "ok";
            return (
              <div key={m.label} className="cgr-meter">
                <span className="cgr-lbl">{m.label}</span>
                <span className="cgr-track">
                  <span className={`cgr-bar ${lvl}`} style={{ width: `${pct}%` } as CSSProperties} />
                </span>
                <span className="cgr-num">
                  {m.used}
                  {m.unit ?? ""} / {m.limit}
                  {m.unit ?? ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="cgr-kernel">
          <Gopher
            pose={f.event ? "carry" : "idle"}
            state={f.event ? "bad" : "idle"}
            size={40}
            role="guard"
            title="the kernel"
          />
          <span className="cgr-klbl">kernel</span>
          {f.event && <span key={f.event} className="cgr-event">{f.event}</span>}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   OverlayAnim — how a container image becomes one
   filesystem. Read-only layers stack bottom-up, a
   writable layer sits on top, and the merged view
   is what the process sees. Writes copy-up into the
   top layer; deletes leave a whiteout marker there.
   ════════════════════════════════════════════ */
type OvFile = { name: string; state?: "normal" | "new" | "changed" | "whiteout" | "hidden" };
type OvLayer = { name: string; ro?: boolean; files: OvFile[] };
type OvFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  layers: OvLayer[]; // bottom first
  merged: OvFile[];
};

export function OverlayAnim({
  title = "Image layers → one filesystem",
  frames,
  caption,
}: {
  title?: string;
  frames: OvFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  const chip = (x: OvFile) => (
    <span key={`${x.name}-${x.state ?? "normal"}`} className={`ovl-file ${x.state ?? "normal"}`}>
      {x.state === "whiteout" ? `✕ ${x.name}` : x.name}
    </span>
  );
  return (
    <AnimShell
      title={title}
      kicker="overlayfs"
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
      <div className="ovl">
        <div className="ovl-merged">
          <span className="ovl-name">
            <Gopher pose="idle" state="ok" size={28} role="captain" title="container" /> merged view (what the process sees)
          </span>
          <div className="ovl-files">{f.merged.map(chip)}</div>
        </div>
        <div className="ovl-stack">
          {[...f.layers].reverse().map((l) => (
            <div key={l.name} className={`ovl-layer ${l.ro ? "ro" : "rw"}`}>
              <span className="ovl-name">
                {l.name} <em>{l.ro ? "read-only" : "writable"}</em>
              </span>
              <div className="ovl-files">
                {l.files.length === 0 ? <span className="ovl-empty">empty</span> : l.files.map(chip)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   GoroutineAnim — goroutines as gophers in lanes.
   `go f()` makes a gopher walk in; it works, blocks,
   or finishes on its own lane while main keeps
   going. When main returns, every gopher still on
   stage is killed mid-task: the most surprising rule
   of goroutines, drawn literally. A stdout strip
   shows what actually got printed.
   ════════════════════════════════════════════ */
type GoLaneState = "run" | "blocked" | "done" | "killed";
type GoFrame = {
  code?: string;
  note: string;
  beat?: "problem" | "solution" | "neutral";
  main: "run" | "blocked" | "exited";
  goroutines: { name: string; state: GoLaneState; task?: string }[];
  stdout?: string[];
};

export function GoroutineAnim({
  title = "What `go` actually does",
  frames,
  caption,
}: {
  title?: string;
  frames: GoFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  const pose = (s: GoLaneState | GoFrame["main"]): GopherPose =>
    s === "run" ? "run" : s === "blocked" ? "blocked" : s === "done" ? "happy" : s === "killed" ? "panic" : "exit";
  const state = (s: GoLaneState | GoFrame["main"]) =>
    s === "run" ? "active" : s === "blocked" ? "warn" : s === "done" ? "done" : "bad";
  return (
    <AnimShell
      title={title}
      kicker="goroutines"
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
      <div className="gor">
        {f.code && <code key={`c${st.cur}`} className="gor-code">{f.code}</code>}
        <div className="gor-lanes">
          <div className={`gor-lane main ${f.main}`}>
            <span className="gor-name">main</span>
            <span className="gor-actor">
              <Gopher pose={pose(f.main)} state={state(f.main)} size={36} role="banker" title="main goroutine" />
            </span>
            <span className="gor-task">{f.main === "exited" ? "returned: program over" : f.main === "blocked" ? "waiting" : "running"}</span>
          </div>
          {f.goroutines.map((g) => (
            <div key={g.name} className={`gor-lane ${g.state}`}>
              <span className="gor-name">{g.name}</span>
              <span key={`${g.name}-${g.state}`} className="gor-actor enter">
                <Gopher pose={pose(g.state)} state={state(g.state)} size={36} role="courier" title={g.name} />
              </span>
              <span className="gor-task">{g.task ?? g.state}</span>
            </div>
          ))}
        </div>
        <div className="gor-out">
          <span className="gor-out-lbl">stdout</span>
          {(f.stdout ?? []).length === 0 ? (
            <span className="gor-out-empty">(nothing printed)</span>
          ) : (
            (f.stdout ?? []).map((l, i) => (
              <span key={`${i}-${l}`} className="gor-out-line">{l}</span>
            ))
          )}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RendezvousAnim — an unbuffered channel is a
   handshake, not a mailbox. The sender gopher holds
   the value; whichever side arrives first PARKS; the
   value physically travels across only when both
   are present, and both wake together.
   ════════════════════════════════════════════ */
type RvSide = "away" | "running" | "parked" | "handoff" | "done";
type RvFrame = {
  code?: string;
  note: string;
  beat?: "problem" | "solution" | "neutral";
  sender: RvSide;
  receiver: RvSide;
  value?: string;
  at?: "sender" | "channel" | "receiver"; // where the value is drawn
};

export function RendezvousAnim({
  title = "Unbuffered channel: a handshake",
  senderLabel = "sender goroutine",
  receiverLabel = "receiver (main)",
  frames,
  caption,
}: {
  title?: string;
  senderLabel?: string;
  receiverLabel?: string;
  frames: RvFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2100);
  const f = frames[st.cur] ?? frames[0];
  const pose = (s: RvSide): GopherPose =>
    s === "parked" ? "blocked" : s === "handoff" ? "carry" : s === "done" ? "happy" : s === "away" ? "idle" : "run";
  const gstate = (s: RvSide) =>
    s === "parked" ? "warn" : s === "handoff" ? "active" : s === "done" ? "done" : "idle";
  const label = (s: RvSide) =>
    s === "parked" ? "parked (blocked)" : s === "handoff" ? "handing off" : s === "done" ? "unblocked" : s === "away" ? "not here yet" : "running";
  return (
    <AnimShell
      title={title}
      kicker="chan (cap 0)"
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
      <div className="rdv">
        {f.code && <code key={`c${st.cur}`} className="rdv-code">{f.code}</code>}
        <div className="rdv-track">
          <div className={`rdv-side ${f.sender}`}>
            <Gopher pose={pose(f.sender)} state={gstate(f.sender)} size={44} role="courier" title={senderLabel} />
            <span className="rdv-name">{senderLabel}</span>
            <span className="rdv-state">{label(f.sender)}</span>
          </div>
          <div className="rdv-pipe">
            <span className="rdv-pipe-lbl">meeting point (no storage)</span>
            {f.value && (
              <span className={`rdv-value at-${f.at ?? "sender"}`}>{f.value}</span>
            )}
          </div>
          <div className={`rdv-side ${f.receiver}`}>
            <Gopher pose={pose(f.receiver)} state={gstate(f.receiver)} size={44} role="banker" title={receiverLabel} />
            <span className="rdv-name">{receiverLabel}</span>
            <span className="rdv-state">{label(f.receiver)}</span>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RaceAnim — the lost update, one CPU step at a
   time. `balance += 100` is really READ → ADD →
   WRITE. Two goroutines each copy the shared value
   into their own register; when their steps
   interleave, one WRITE overwrites the other and a
   deposit vanishes. With a mutex, the second
   goroutine waits at the door until the first is
   completely done.
   ════════════════════════════════════════════ */
type RaceStep = "idle" | "read" | "add" | "write" | "wait" | "done";
type RaceFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  shared: string;
  expected?: string;
  lock?: string | null; // name of the goroutine holding the mutex, if any
  lanes: { name: string; step: RaceStep; local?: string }[];
};

export function RaceAnim({
  title = "balance += 100, one CPU step at a time",
  label = "balance",
  frames,
  caption,
}: {
  title?: string;
  label?: string;
  frames: RaceFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  // Only judge the result once every goroutine has finished: mid-way, a
  // balance below the expected total is just work still in progress.
  const finished = f.lanes.every((l) => l.step === "done");
  const wrong = finished && f.expected !== undefined && f.expected !== f.shared;
  const right = finished && f.expected !== undefined && f.expected === f.shared;
  const steps: RaceStep[] = ["read", "add", "write"];
  return (
    <AnimShell
      title={title}
      kicker={f.lock !== undefined ? "mutex" : "data race"}
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
      <div className="rce">
        {f.lanes.slice(0, 1).map((l) => lane(l))}
        <div className={`rce-mem ${wrong ? "bad" : ""}`}>
          <span className="rce-lbl">shared memory</span>
          <span className="rce-var">{label}</span>
          <span key={f.shared} className="rce-val">{f.shared}</span>
          {f.expected !== undefined && (
            <span className={`rce-exp ${wrong ? "bad" : right ? "ok" : ""}`}>
              {wrong ? `expected ${f.expected}: deposit lost` : right ? `expected ${f.expected} ✓` : `expected ${f.expected}`}
            </span>
          )}
          {f.lock !== undefined && (
            <span className={`rce-lock ${f.lock ? "held" : ""}`}>🔒 {f.lock ? `held by ${f.lock}` : "unlocked"}</span>
          )}
        </div>
        {f.lanes.slice(1).map((l) => lane(l))}
      </div>
    </AnimShell>
  );

  function lane(l: RaceFrame["lanes"][number]) {
    const busy = l.step === "read" || l.step === "add" || l.step === "write";
    return (
      <div key={l.name} className={`rce-lane ${l.step}`}>
        <Gopher
          pose={l.step === "wait" ? "blocked" : l.step === "done" ? "happy" : busy ? "carry" : "idle"}
          state={l.step === "wait" ? "warn" : l.step === "done" ? "done" : busy ? "active" : "idle"}
          size={38}
          role="banker"
          title={l.name}
        />
        <span className="rce-name">{l.name}</span>
        <div className="rce-steps">
          {steps.map((s) => (
            <span key={s} className={`rce-step ${l.step === s ? "on" : ""} ${steps.indexOf(s) < steps.indexOf(l.step as RaceStep) || l.step === "done" ? "past" : ""}`}>
              {s}
            </span>
          ))}
        </div>
        <span className="rce-reg">
          register: <b key={l.local ?? "-"}>{l.local ?? "—"}</b>
        </span>
        {l.step === "wait" && <span className="rce-wait">waiting for lock</span>}
      </div>
    );
  }
}

/* ════════════════════════════════════════════
   OdometerAnim — a fixed-size integer drawn as a
   car odometer: one wheel per bit, rolling over
   with the carry from right to left. Two readouts
   show the same bits as signed and unsigned, so
   127 + 1 visibly lands on -128. A guard frame
   shows the check that refuses before adding.
   ════════════════════════════════════════════ */
export type OdometerFrame = {
  /** the register's bits, 0..2^width-1 */
  bits: number;
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** label on the gopher's crank, e.g. "+1" */
  op?: string;
  /** the overflow check refused this step: the wheels don't move */
  refused?: string;
};

export function OdometerAnim({
  title = "A fixed-size integer",
  width = 8,
  frames,
  caption,
}: {
  title?: string;
  width?: number;
  frames: OdometerFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1900);
  const f = frames[st.cur] ?? frames[0];
  const mod = 2 ** width;
  const unsigned = (b: number) => ((b % mod) + mod) % mod;
  const toSigned = (b: number) => (unsigned(b) >= mod / 2 ? unsigned(b) - mod : unsigned(b));
  const u = unsigned(f.bits);
  const signed = toSigned(f.bits);
  // wrapped: this step added to a non-negative number and landed on a negative one
  const wrapped =
    !f.refused && st.cur > 0 && signed < 0 && toSigned(frames[st.cur - 1].bits) >= 0;
  return (
    <AnimShell
      title={title}
      kicker={`int${width} · odometer`}
      note={f.note}
      beat={f.beat ?? (wrapped ? "problem" : "neutral")}
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
      <div className="odo">
        <div className="odo-crank">
          <Gopher
            pose={f.refused ? "blocked" : wrapped ? "panic" : st.playing ? "run" : "idle"}
            state={f.refused ? "warn" : wrapped ? "bad" : "active"}
            role="mechanic"
            size={46}
            title="the counter"
          />
          <span className={`odo-op ${f.refused ? "odo-op-no" : ""}`}>{f.refused ?? f.op ?? "+1"}</span>
        </div>
        <div className={`odo-body ${wrapped ? "odo-body-bad" : ""} ${f.refused ? "odo-body-guard" : ""}`}>
          <div className="odo-wheels">
            {Array.from({ length: width }, (_, i) => {
              const place = width - 1 - i;
              const bit = (u >> place) & 1;
              return (
                <div key={i} className={`odo-wheel ${i === 0 ? "odo-sign" : ""}`}>
                  <div
                    className="odo-strip"
                    style={{
                      transform: `translateY(${-bit * 50}%)`,
                      transitionDelay: `${place * 70}ms`,
                    }}
                  >
                    <span>0</span>
                    <span>1</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="odo-places">
            {Array.from({ length: width }, (_, i) => {
              const place = width - 1 - i;
              return (
                <span key={i} className={i === 0 ? "odo-sign-l" : ""}>
                  {i === 0 ? `−${2 ** place}` : 2 ** place}
                </span>
              );
            })}
          </div>
        </div>
        <div className="odo-read">
          <div className={`odo-val ${signed < 0 && wrapped ? "odo-val-bad" : ""}`}>
            <span className="odo-k">as int{width}</span>
            <span className="odo-n">{signed}</span>
          </div>
          <div className="odo-val odo-val-dim">
            <span className="odo-k">as uint{width}</span>
            <span className="odo-n">{u}</span>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ErrorChainAnim — a wrapped error drawn as what
   it is: boxes nested inside boxes (%w), or one
   flat box (%v). A detective gopher compares the
   target against one layer at a time, the way
   errors.Is walks Unwrap.
   ════════════════════════════════════════════ */
export type ErrorChainFrame = {
  /** layers, outermost first; each is the text that layer adds */
  chain: string[];
  /** the sentinel errors.Is is looking for */
  target?: string;
  /** which layer is being compared now (index into chain) */
  probe?: number;
  /** "match" / "miss" for the probed layer, "none" when the chain ran out */
  result?: "match" | "miss" | "none";
  /** a label for how the check is done, e.g. "==" or "errors.Is" */
  check?: string;
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

export function ErrorChainAnim({
  title = "errors.Is walks the chain",
  frames,
  caption,
}: {
  title?: string;
  frames: ErrorChainFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1900);
  const f = frames[st.cur] ?? frames[0];
  const nest = (i: number): ReactNode => {
    if (i >= f.chain.length) return null;
    const probed = f.probe === i;
    const cls = probed ? (f.result === "match" ? "ech-match" : f.result === "miss" ? "ech-miss" : "ech-probe") : "";
    return (
      <div className={`ech-box ${cls} ${i === f.chain.length - 1 ? "ech-core" : ""}`}>
        <span className="ech-text">{f.chain[i]}</span>
        {nest(i + 1)}
      </div>
    );
  };
  const beat = f.beat ?? (f.result === "match" ? "solution" : f.result === "none" || f.result === "miss" ? "problem" : "neutral");
  return (
    <AnimShell
      title={title}
      kicker="error chain"
      note={f.note}
      beat={beat}
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
      <div className="ech">
        <div className="ech-who">
          <Gopher
            role="detective"
            pose={f.result === "match" ? "happy" : f.result === "none" ? "blocked" : "idle"}
            state={f.result === "match" ? "ok" : f.result === "none" || f.result === "miss" ? "warn" : "active"}
            size={46}
            title="the caller"
          />
          {f.check && <span className="ech-check">{f.check}</span>}
          {f.target && <span className="ech-target">looking for {f.target}</span>}
        </div>
        <div className="ech-chain">{nest(0)}</div>
        {f.result === "none" && <span className="ech-none">no match: nothing left to unwrap</span>}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ExpiryAnim — a store's map drawn as its table
   of slots. Each key carries a timer; a reader
   gopher deletes an expired key it touches (lazy
   expiry), a sweeper gopher samples slots (active
   expiry), and the table's size shows that a Go
   map keeps its slots until it's rebuilt.
   ════════════════════════════════════════════ */
export type ExpirySlot = {
  k: string;
  /** clock second at which it expires; omit for no expiry */
  exp?: number;
};

export type ExpiryFrame = {
  /** the clock, in seconds */
  t: number;
  /** the table: one entry per slot, null for an empty slot */
  slots: (ExpirySlot | null)[];
  /** slot the reader gopher is touching */
  read?: number;
  /** slots the sweeper is sampling */
  sweep?: number[];
  note: string;
  beat?: "problem" | "solution" | "neutral";
};

export function ExpiryAnim({
  title = "Keys that expire",
  frames,
  caption,
}: {
  title?: string;
  frames: ExpiryFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2000);
  const f = frames[st.cur] ?? frames[0];
  const live = f.slots.filter((s) => s && (s.exp === undefined || s.exp > f.t)).length;
  const dead = f.slots.filter((s) => s && s.exp !== undefined && s.exp <= f.t).length;
  const maxSlots = Math.max(...frames.map((x) => x.slots.length));
  return (
    <AnimShell
      title={title}
      kicker="expiry · the map"
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
      <div className="exq">
        <div className="exq-top">
          <span className="exq-clock">t = {f.t}s</span>
          <span className="exq-count">
            {live} live · <b className={dead ? "exq-dead-n" : ""}>{dead} expired, still stored</b>
          </span>
        </div>
        <div className="exq-grid">
          {f.slots.map((s, i) => {
            const expired = !!s && s.exp !== undefined && s.exp <= f.t;
            const sampled = f.sweep?.includes(i);
            return (
              <div
                key={i}
                className={`exq-slot ${!s ? "exq-empty" : expired ? "exq-expired" : "exq-live"} ${sampled ? "exq-sampled" : ""} ${f.read === i ? "exq-read" : ""}`}
              >
                {f.read === i && (
                  <span className="exq-gph">
                    <Gopher role="reader" pose={expired ? "blocked" : "happy"} state={expired ? "warn" : "ok"} size={30} title="a reader" />
                  </span>
                )}
                {sampled && (
                  <span className="exq-gph">
                    <Gopher role="sweeper" pose="run" state="active" size={30} title="the sweeper" />
                  </span>
                )}
                {s && (
                  <>
                    <span className="exq-k">{s.k}</span>
                    <span className="exq-ttl">{s.exp === undefined ? "no expiry" : expired ? "expired" : `${s.exp - f.t}s left`}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="exq-mem">
          <span className="exq-mem-k">table size</span>
          <div className="exq-bar">
            <div className="exq-fill" style={{ width: `${(f.slots.length / maxSlots) * 100}%` }} />
          </div>
          <span className="exq-mem-n">{f.slots.length} slots</span>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RelationAnim — a mental-model diagram that
   builds up one relationship at a time: boxes
   (packages, files, types, interfaces, values)
   and labelled arrows between them. Each frame
   says which boxes and arrows exist yet, which
   are lit, and where the gopher stands. Made for
   "how does X find / satisfy / wrap Y" pictures:
   imports, method sets, interface values.
   ════════════════════════════════════════════ */
export type RelationNode = {
  id: string;
  label: string;
  sub?: string;
  /** centre, as a percentage of the stage's width and height */
  x: number;
  y: number;
  kind?: "pkg" | "file" | "cmd" | "type" | "iface" | "value" | "tool";
};

export type RelationEdge = { from: string; to: string; label?: string; dashed?: boolean };

export type RelationFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** node ids and edge ids ("from>to") visible in this frame; omit to show everything */
  show?: string[];
  /** ids lit up in this frame */
  hot?: string[];
  /** ids drawn as broken/refused in this frame */
  bad?: string[];
  /** node the gopher stands on, and what it says */
  at?: string;
  say?: string;
};

export function RelationAnim({
  title,
  kicker = "mental model",
  nodes,
  edges,
  frames,
  role = "reader",
  height = 60,
  caption,
}: {
  title: string;
  kicker?: string;
  nodes: RelationNode[];
  edges: RelationEdge[];
  frames: RelationFrame[];
  role?: GopherRole;
  /** stage height as a percentage of its width */
  height?: number;
  caption?: string;
}) {
  const st = useStepper(frames.length, 2100);
  const f = frames[st.cur] ?? frames[0];
  const eid = (e: RelationEdge) => `${e.from}>${e.to}`;
  const visible = (id: string) => !f.show || f.show.includes(id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const W = 1000;
  const H = height * 10;
  const at = f.at ? byId.get(f.at) : undefined;
  // measure each box, in the SVG's units, so arrows can stop at its border
  const stage = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const scale = W / (el.clientWidth || W);
      const next: Record<string, { w: number; h: number }> = {};
      el.querySelectorAll<HTMLElement>("[data-rel-id]").forEach((n) => {
        next[n.dataset.relId!] = { w: (n.offsetWidth / 2) * scale + 4, h: (n.offsetHeight / 2) * scale + 4 };
      });
      setSizes(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  return (
    <AnimShell
      title={title}
      kicker={kicker}
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
      <div className="rel-scroll">
      <div className="rel" ref={stage} style={{ aspectRatio: `${W} / ${H}` }}>
        <svg className="rel-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <defs>
            <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const id = eid(e);
            const x1 = (a.x / 100) * W, y1 = (a.y / 100) * H;
            const x2 = (b.x / 100) * W, y2 = (b.y / 100) * H;
            // clip the line at each box's edge, so the arrowhead lands on the border
            const half = (n: RelationNode) => sizes[n.id] ?? { w: 90, h: 34 };
            const clip = (n: RelationNode, dx: number, dy: number) => {
              const { w, h } = half(n);
              const t = Math.min(dx ? w / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
              return t;
            };
            const dx = x2 - x1, dy = y2 - y1;
            const t1 = clip(a, dx, dy), t2 = clip(b, dx, dy);
            const sx = x1 + dx * Math.min(t1, 0.45), sy = y1 + dy * Math.min(t1, 0.45);
            const tx = x2 - dx * Math.min(t2, 0.45), ty = y2 - dy * Math.min(t2, 0.45);
            // label: at the middle, pushed off the line on its upper/left side
            const len = Math.hypot(dx, dy) || 1;
            const steep = Math.abs(dx) < Math.abs(dy) * 0.4;
            let nx = -dy / len, ny = dx / len;
            // mostly-horizontal lines: label above; steep lines: label to the right
            if (steep ? nx < 0 : ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
            // steep lines: label beside the line; others: on it, over a halo
            // that masks the line behind the text, so it can't reach a box
            const off = steep ? 14 : 0;
            const lx = (sx + tx) / 2 + nx * off, ly = (sy + ty) / 2 + ny * off;
            const anchor = steep ? "start" : "middle";
            const cls = `rel-edge ${visible(id) ? "on" : ""} ${f.hot?.includes(id) ? "hot" : ""} ${f.bad?.includes(id) ? "bad" : ""} ${e.dashed ? "dashed" : ""}`;
            return (
              <g key={id} className={cls}>
                <line x1={sx} y1={sy} x2={tx} y2={ty} markerEnd="url(#rel-arrow)" />
                {e.label && (
                  <>
                    {/* a backing rectangle hides the line behind the whole label, spaces included */}
                    <rect
                      className="rel-label-bg"
                      x={anchor === "start" ? lx - 4 : lx - e.label.length * 5.2 - 6}
                      y={ly - 12}
                      width={e.label.length * 10.4 + 12}
                      height={24}
                      rx={6}
                    />
                    <text x={lx} y={ly + 6} textAnchor={anchor}>
                      {e.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => (
          <div
            key={n.id}
            data-rel-id={n.id}
            className={`rel-node rel-${n.kind ?? "pkg"} ${visible(n.id) ? "on" : ""} ${f.hot?.includes(n.id) ? "hot" : ""} ${f.bad?.includes(n.id) ? "bad" : ""}`}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <span className="rel-label">{n.label}</span>
            {n.sub && <span className="rel-sub">{n.sub}</span>}
          </div>
        ))}
        {at && (
          <div className="rel-gopher" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
            {f.say && <span className="rel-say">{f.say}</span>}
            <Gopher role={role} pose={f.beat === "problem" ? "blocked" : f.beat === "solution" ? "happy" : "idle"} state="active" size={34} />
          </div>
        )}
      </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   StreamAnim — reading a big file two ways. On
   the left the file on disk, with a read head;
   in the middle the reader; on the right the
   process's memory as a gauge in MB, holding
   whatever the program still references. Load-
   all fills it; streaming holds one record and a
   running total while the GC takes the rest.
   ════════════════════════════════════════════ */
export type StreamFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** how much of the file has been read, 0..1 */
  read: number;
  /** what the process is holding right now */
  held: string[];
  /** resident memory, in MB: the gauge's fill */
  mb: number;
  /** what the gauge says; defaults to "<mb> MB". Use it for in-between frames that weren't measured */
  gauge?: string;
  /** records the GC has freed so far (a label, e.g. "2,999,999") */
  freed?: string;
  /** the running result, e.g. a total */
  total?: string;
  /** what the reader gopher says */
  say?: string;
};

export function StreamAnim({
  title,
  kicker = "memory · live",
  file,
  maxMb,
  frames,
  caption,
}: {
  title: string;
  kicker?: string;
  /** the file's label, e.g. "settle-3m.csv · 276 MB" */
  file: string;
  /** the gauge's full scale, in MB */
  maxMb: number;
  frames: StreamFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2000);
  const f = frames[st.cur] ?? frames[0];
  const pct = Math.min(100, (f.mb / maxMb) * 100);
  const stripes = 24;
  return (
    <AnimShell
      title={title}
      kicker={kicker}
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
      <div className="stm">
        <div className="stm-col">
          <span className="stm-k">on disk</span>
          <div className="stm-file">
            {Array.from({ length: stripes }, (_, i) => (
              <i key={i} className={i / stripes < f.read ? "done" : ""} />
            ))}
            <span className="stm-head" style={{ top: `${f.read * 100}%` }} />
          </div>
          <span className="stm-name">{file}</span>
        </div>
        <div className="stm-reader">
          {f.say && <span className="stm-say">{f.say}</span>}
          <Gopher role="worker" pose={f.beat === "problem" ? "panic" : f.read > 0 && f.read < 1 ? "carry" : "idle"} state={f.beat === "problem" ? "bad" : "active"} size={44} title="the reader" />
          <span className="stm-arrow" aria-hidden>→</span>
        </div>
        <div className="stm-col stm-memcol">
          <span className="stm-k">the process's memory</span>
          <div className="stm-mem">
            <div className="stm-held">
              {f.held.map((h, i) => (
                <span key={h + i} className="stm-item">{h}</span>
              ))}
              {f.held.length === 0 && <span className="stm-empty">nothing held</span>}
            </div>
            <div className={`stm-gauge ${f.beat === "problem" ? "bad" : f.beat === "solution" ? "good" : ""}`}>
              <div className="stm-fill" style={{ height: `${pct}%` }} />
              <span className="stm-mb">{f.gauge ?? `${f.mb} MB`}</span>
            </div>
          </div>
          <div className="stm-foot">
            <span>GC freed: <b>{f.freed ?? "0"}</b> records</span>
            {f.total && <span>total: <b>{f.total}</b></span>}
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LRUAnim — a size-limited cache. Exact mode: the
   recency list itself, most recent on the left;
   a GET or SET slides that key's card to the front
   and a full cache drops the card at the back.
   Sampled mode (Redis): no list, each key carries
   the time it was last used, and eviction compares
   only a few sampled keys.
   ════════════════════════════════════════════ */
export type LRUFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** the command being run, e.g. "GET a" */
  op?: string;
  /** keys in the cache; exact mode: most recent first */
  keys: string[];
  /** sampled mode: last-used clock per key */
  used?: Record<string, number>;
  /** keys the eviction is looking at */
  sample?: string[];
  /** key just used (hit or set) */
  hot?: string;
  /** key leaving the cache in this frame */
  evict?: string;
  /** a GET that found nothing */
  miss?: string;
};

export function LRUAnim({
  title,
  max,
  frames,
  caption,
}: {
  title: string;
  /** the size limit */
  max: number;
  frames: LRUFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 1900);
  const f = frames[st.cur] ?? frames[0];
  const sampled = !!f.used;
  const all = f.evict && !f.keys.includes(f.evict) ? [...f.keys, f.evict] : f.keys;
  const slotW = 100 / Math.max(max + 1, all.length);
  return (
    <AnimShell
      title={title}
      kicker={sampled ? "eviction · sampled" : "eviction · exact LRU"}
      note={f.note}
      beat={f.beat ?? (f.evict ? "problem" : "neutral")}
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
      <div className="lru">
        <div className="lru-top">
          <Gopher role="librarian" pose={f.miss ? "blocked" : f.evict ? "carry" : "idle"} state={f.miss ? "warn" : "active"} size={38} title="the cache" />
          {f.op && <code className="lru-op">{f.op}</code>}
          {f.miss && <span className="lru-miss">miss: not in the cache</span>}
          <span className="lru-cap">{f.keys.length} / {max} keys</span>
        </div>
        {!sampled && (
          <div className="lru-ends">
            <span>most recent</span>
            <span>least recent: evicted first</span>
          </div>
        )}
        <div className="lru-row">
          {all.map((k) => {
            const i = f.keys.indexOf(k);
            const gone = f.evict === k;
            const left = (gone ? f.keys.length : i) * slotW;
            return (
              <div
                key={k}
                className={`lru-card ${f.hot === k ? "hot" : ""} ${gone ? "gone" : ""} ${f.sample?.includes(k) ? "sampled" : ""}`}
                style={{ left: `${left}%`, width: `calc(${slotW}% - 8px)` }}
              >
                <span className="lru-key">{k}</span>
                {f.used && <span className="lru-used">used at {f.used[k] ?? "–"}</span>}
              </div>
            );
          })}
        </div>
        {!sampled && <div className="lru-arrow" aria-hidden />}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RoundTripAnim — a client, a server and the
   network between them. Commands cross left to
   right as chips, replies cross back; a clock
   counts round trips and the server counts its
   write calls. One command per trip against a
   whole pipeline per trip.
   ════════════════════════════════════════════ */
export type RoundTripFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** chips crossing client → server in this frame */
  send?: string[];
  /** chips crossing server → client in this frame */
  reply?: string[];
  /** round trips so far */
  trips: number;
  /** the server's write calls so far */
  writes?: number;
  /** what the server is doing */
  server?: string;
};

export function RoundTripAnim({
  title,
  rtt,
  frames,
  caption,
}: {
  title: string;
  /** a measured round-trip time to show on the wire, if there is one */
  rtt?: string;
  frames: RoundTripFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2000);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="round trips"
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
      <div className="rtp">
        <div className="rtp-end">
          <Gopher role="operator" pose={f.send?.length ? "carry" : f.reply?.length ? "happy" : "idle"} state="active" size={42} title="the client" />
          <span className="rtp-name">client</span>
        </div>
        <div className="rtp-wire" key={st.cur}>
          <span className="rtp-rtt">{rtt ? `one round trip = ${rtt}` : "one round trip"}</span>
          {(f.send ?? []).length > 0 && (
            <div className="rtp-group rtp-out">
              {f.send!.map((c, i) => (
                <span key={i} className="rtp-chip">
                  {c}
                </span>
              ))}
            </div>
          )}
          {(f.reply ?? []).length > 0 && (
            <div className="rtp-group rtp-back">
              {f.reply!.map((c, i) => (
                <span key={i} className="rtp-chip rtp-reply">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="rtp-end">
          <Gopher role="librarian" pose={f.server ? "carry" : "idle"} state="active" size={42} title="the server" />
          <span className="rtp-name">server</span>
          {f.server && <span className="rtp-srv">{f.server}</span>}
        </div>
      </div>
      <div className="rtp-meters">
        <span className={`rtp-meter ${f.beat === "problem" ? "bad" : f.beat === "solution" ? "good" : ""}`}>
          round trips <b>{f.trips}</b>
        </span>
        {f.writes !== undefined && (
          <span className="rtp-meter">
            server write() calls <b>{f.writes}</b>
          </span>
        )}
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   PlanAnim — Terraform's three truths side by
   side: the configuration (what should exist),
   the state file (what it last saw) and the real
   system (what exists). Refresh copies real into
   state, plan compares config with state, apply
   changes the real system and records it.
   ════════════════════════════════════════════ */
export type PlanRow = {
  addr: string;
  config?: string;
  state?: string;
  real?: string;
  op?: "create" | "update" | "replace" | "delete";
};

export type PlanFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  phase?: "edit" | "refresh" | "plan" | "apply" | "drift";
  rows: PlanRow[];
};

const PLAN_SYMBOL: Record<NonNullable<PlanRow["op"]>, string> = {
  create: "+ create",
  update: "~ update",
  replace: "-/+ replace",
  delete: "- destroy",
};

export function PlanAnim({
  title,
  realLabel = "the real system",
  frames,
  caption,
}: {
  title: string;
  realLabel?: string;
  frames: PlanFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  const ph = f.phase ?? "plan";
  const cell = (v: string | undefined, other: string | undefined, col: string) => (
    <span className={`pla-cell ${v === undefined ? "pla-none" : ""} ${other !== undefined && v !== other ? "pla-diff" : ""} pla-col-${col}`}>
      {v ?? "—"}
    </span>
  );
  const who: Record<string, { at: string; say: string; role: GopherRole }> = {
    edit: { at: "config", say: "edit .tf", role: "reader" },
    refresh: { at: "real", say: "Read()", role: "detective" },
    plan: { at: "plan", say: "compare", role: "architect" },
    apply: { at: "real", say: "Create/Update/Delete", role: "worker" },
    drift: { at: "real", say: "changed by hand", role: "hacker" },
  };
  const g = who[ph];
  return (
    <AnimShell
      title={title}
      kicker={`terraform · ${ph}`}
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
      <div className="pla-scroll">
        <div className={`pla pla-phase-${ph}`}>
          <span className="pla-h">resource</span>
          <span className={`pla-h ${g.at === "config" ? "on" : ""}`}>configuration (.tf)</span>
          <span className={`pla-h ${ph === "refresh" || ph === "apply" ? "on" : ""}`}>state (.tfstate)</span>
          <span className={`pla-h ${g.at === "real" ? "on" : ""}`}>{realLabel}</span>
          <span className={`pla-h ${g.at === "plan" ? "on" : ""}`}>plan</span>
          {f.rows.map((r) => (
            <Fragment key={r.addr}>
              <span className="pla-addr">{r.addr}</span>
              {cell(r.config, r.state, "config")}
              {cell(r.state, r.config, "state")}
              {cell(r.real, r.state, "real")}
              <span className={`pla-op ${r.op ? `pla-op-${r.op}` : ""}`}>{r.op ? PLAN_SYMBOL[r.op] : ""}</span>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="pla-who">
        <Gopher role={g.role} pose={ph === "drift" ? "run" : ph === "apply" ? "carry" : "idle"} state={f.beat === "problem" ? "warn" : "active"} size={36} />
        <span className="pla-say">{g.say}</span>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ReconcileAnim — the controller pattern. Watch
   events arrive from the API server; the work
   queue keeps one entry per object however many
   events there were; a worker takes a key and
   compares the whole desired state with the
   whole actual state, then writes only what
   differs. It never sees what the event was.
   ════════════════════════════════════════════ */
export type ReconcileRow = { field: string; want: string; have?: string };

export type ReconcileFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** events arriving from the watch in this frame */
  events?: string[];
  /** keys waiting in the work queue */
  queue: string[];
  /** the key being reconciled, if any */
  working?: string;
  rows?: ReconcileRow[];
  /** what the reconcile wrote, if anything */
  wrote?: string;
};

export function ReconcileAnim({
  title,
  frames,
  caption,
}: {
  title: string;
  frames: ReconcileFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2200);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="controller · reconcile"
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
      <div className="rcl">
        <div className="rcl-col">
          <span className="rcl-k">watch events</span>
          <div className="rcl-events" key={st.cur}>
            {(f.events ?? []).map((e, i) => (
              <span key={i} className="rcl-ev" style={{ animationDelay: `${i * 120}ms` }}>
                {e}
              </span>
            ))}
            {!f.events?.length && <span className="rcl-quiet">quiet</span>}
          </div>
        </div>
        <div className="rcl-col">
          <span className="rcl-k">work queue</span>
          <div className="rcl-queue">
            {f.queue.map((q) => (
              <span key={q} className="rcl-key">{q}</span>
            ))}
            {f.queue.length === 0 && <span className="rcl-quiet">empty</span>}
          </div>
        </div>
        <div className="rcl-col rcl-worker">
          <div className="rcl-who">
            <Gopher role="worker" pose={f.working ? (f.wrote ? "carry" : "run") : "idle"} state={f.beat === "problem" ? "warn" : "active"} size={38} />
            <span className="rcl-k">{f.working ? `Reconcile(${f.working})` : "waiting"}</span>
          </div>
          {f.rows && (
            <div className="rcl-table">
              <span className="rcl-h">field</span>
              <span className="rcl-h">desired</span>
              <span className="rcl-h">actual</span>
              {f.rows.map((r) => (
                <Fragment key={r.field}>
                  <span className="rcl-f">{r.field}</span>
                  <span className="rcl-v">{r.want}</span>
                  <span className={`rcl-v ${r.have === undefined ? "rcl-miss" : r.have !== r.want ? "rcl-diff" : "rcl-same"}`}>{r.have ?? "missing"}</span>
                </Fragment>
              ))}
            </div>
          )}
          {f.working && <span className={`rcl-wrote ${f.wrote ? "on" : ""}`}>{f.wrote ?? "no write: already matches"}</span>}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   BurnAnim — a multi-window burn-rate alert.
   Each bar is one period's server-error ratio;
   a long and a short window slide over the
   latest bars; the page fires only when both
   windows' averages exceed the threshold (burn
   rate × the error budget). The alert light is
   computed from the bars, never set by hand.
   ════════════════════════════════════════════ */
export type BurnFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** error ratio of each period, in percent, oldest first */
  bars: number[];
  /** error budget left for the month, in percent */
  budget: number;
};

export function BurnAnim({
  title,
  slo = 99.9,
  burn = 14.4,
  long = 12,
  short = 1,
  longLabel = "1 h",
  shortLabel = "5 min",
  frames,
  caption,
}: {
  title: string;
  /** the SLO, in percent */
  slo?: number;
  /** the burn-rate multiple that pages */
  burn?: number;
  /** window lengths, in bars */
  long?: number;
  short?: number;
  longLabel?: string;
  shortLabel?: string;
  frames: BurnFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2000);
  const f = frames[st.cur] ?? frames[0];
  const threshold = burn * (100 - slo); // percent
  const avg = (n: number) => {
    const w = f.bars.slice(-n);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0;
  };
  const la = avg(long);
  const sa = avg(short);
  const paging = la > threshold && sa > threshold;
  const top = Math.max(6, ...frames.flatMap((x) => x.bars)) * 1.1;
  const n = f.bars.length;
  return (
    <AnimShell
      title={title}
      kicker={`SLO ${slo}% · burn ${burn}×`}
      note={f.note}
      beat={f.beat ?? (paging ? "problem" : "neutral")}
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
      <div className="brn">
        <div className="brn-chart">
          <div className="brn-thr" style={{ bottom: `${(threshold / top) * 100}%` }}>
            <span>page above {threshold.toFixed(2)}%</span>
          </div>
          <div className="brn-win brn-long" style={{ left: `${((n - Math.min(long, n)) / n) * 100}%`, width: `${(Math.min(long, n) / n) * 100}%` }}>
            <span>{longLabel}: {la.toFixed(2)}%</span>
          </div>
          <div className="brn-win brn-short" style={{ left: `${((n - Math.min(short, n)) / n) * 100}%`, width: `${(Math.min(short, n) / n) * 100}%` }}>
            <span>{shortLabel}: {sa.toFixed(2)}%</span>
          </div>
          <div className="brn-bars">
            {f.bars.map((b, i) => (
              <i key={i} className={b > threshold ? "hot" : ""} style={{ height: `${Math.max(1.5, (b / top) * 100)}%` }} />
            ))}
          </div>
        </div>
        <div className="brn-side">
          <div className={`brn-light ${paging ? "on" : ""}`}>
            <Gopher role="medic" pose={paging ? "panic" : "idle"} state={paging ? "bad" : "ok"} size={40} />
            <span>{paging ? "PAGING" : "quiet"}</span>
          </div>
          <div className="brn-budget">
            <span className="brn-k">budget left</span>
            <div className="brn-gauge">
              <div className="brn-fill" style={{ width: `${Math.max(0, f.budget)}%` }} />
            </div>
            <span className="brn-n">{f.budget.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   RolloutAnim — a rolling update seen from the
   Service. Pods move through starting → ready →
   draining → gone; the Service only routes to
   pods in its endpoints; each pod shows what
   happened to the last request sent to it.
   ════════════════════════════════════════════ */
export type RolloutPod = {
  name: string;
  version: string;
  state: "starting" | "ready" | "draining" | "gone";
  /** is it in the Service's endpoints right now? */
  routed: boolean;
  /** what happened to the latest request sent to it */
  last?: "ok" | "refused" | "cut";
};

export type RolloutFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  pods: RolloutPod[];
  /** failed requests so far in this animation (not a measurement) */
  errors: number;
};

export function RolloutAnim({
  title,
  frames,
  caption,
}: {
  title: string;
  frames: RolloutFrame[];
  caption?: string;
}) {
  const st = useStepper(frames.length, 2100);
  const f = frames[st.cur] ?? frames[0];
  const LAST = { ok: "201", refused: "refused", cut: "cut off" } as const;
  return (
    <AnimShell
      title={title}
      kicker="rolling update"
      note={f.note}
      beat={f.beat ?? (f.pods.some((p) => p.last && p.last !== "ok") ? "problem" : "neutral")}
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
      <div className="rol">
        <div className="rol-svc">
          <Gopher role="pilot" pose="idle" state="active" size={38} />
          <span className="rol-k">Service ledgerd</span>
          <span className="rol-counts">
            errors in this picture: <b className={f.errors ? "rol-bad" : "rol-ok"}>{f.errors}</b>
          </span>
        </div>
        <div className="rol-pods">
          {f.pods.map((p) => (
            <div key={p.name} className={`rol-pod rol-${p.state} ${p.routed ? "routed" : ""}`}>
              <span className="rol-line" aria-hidden />
              <span className="rol-name">{p.name}</span>
              <span className="rol-ver">{p.version}</span>
              <span className="rol-state">{p.state}{p.routed ? " · in endpoints" : ""}</span>
              {p.last && <span className={`rol-last rol-last-${p.last}`}>{LAST[p.last]}</span>}
            </div>
          ))}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ShopCacheAnim — why Redis exists: a shop's
   product page asked of Postgres (a join over
   the product's 2,000 reviews, every time) and
   of Redis (one key holding the finished page).
   The measured numbers ride in the frames.
   ════════════════════════════════════════════ */

export type ShopCacheFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** how many shoppers are asking at once */
  shoppers: number;
  /** which store the app asks this frame */
  ask?: "postgres" | "redis" | "both";
  /** what Postgres is doing */
  pg?: string;
  /** what Redis is doing */
  redis?: string;
  /** the keys Redis holds right now */
  keys?: string[];
  /** the chip carried back to the shopper */
  answer?: string;
  /** pages/s or time meters for this frame */
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function ShopCacheAnim({ title, frames, caption }: { title: string; frames: ShopCacheFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2400);
  const f = frames[st.cur] ?? frames[0];
  const pgOn = f.ask === "postgres" || f.ask === "both";
  const rdOn = f.ask === "redis" || f.ask === "both";
  return (
    <AnimShell
      title={title}
      kicker="why redis"
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
      <div className="shc" key={st.cur}>
        <div className="shc-col shc-shoppers">
          <div className="shc-crowd">
            {Array.from({ length: Math.min(f.shoppers, 6) }, (_, i) => (
              <Gopher key={i} role={i % 2 ? "reader" : "operator"} look={i % 3 === 1 ? "pink" : undefined} pose={f.answer ? "happy" : f.beat === "problem" ? "blocked" : "idle"} state="active" size={i === 0 ? 40 : 26} title="a shopper" />
            ))}
          </div>
          <span className="shc-name">{f.shoppers > 1 ? `${f.shoppers} shoppers` : "a shopper"}</span>
          {f.answer && <span className="shc-chip shc-ans">{f.answer}</span>}
        </div>
        <div className="shc-col">
          <Gopher role="operator" pose={f.ask ? "run" : "idle"} state="active" size={44} title="the shop's Go server" />
          <span className="shc-name">Go server</span>
        </div>
        <div className="shc-stores">
          <div className={`shc-store ${pgOn ? "on" : ""} ${pgOn && f.beat === "problem" ? "bad" : ""}`}>
            <div className="shc-head">
              <Gopher role="librarian" pose={pgOn ? "carry" : "idle"} state={pgOn && f.beat === "problem" ? "bad" : "active"} size={34} title="Postgres" />
              <span className="shc-title">Postgres <em>on disk, the truth</em></span>
            </div>
            {pgOn && <span className="shc-arrow">⟵ query</span>}
            <span className="shc-doing">{f.pg ?? "products · reviews (2,000,000 rows)"}</span>
          </div>
          <div className={`shc-store ${rdOn ? "on good" : ""}`}>
            <div className="shc-head">
              <Gopher role="courier" pose={rdOn ? "happy" : "idle"} state="active" size={34} title="Redis" />
              <span className="shc-title">Redis <em>in memory, a copy</em></span>
            </div>
            {rdOn && <span className="shc-arrow">⟵ GET</span>}
            <span className="shc-doing">{f.redis ?? (f.keys?.length ? "" : "empty")}</span>
            {f.keys && f.keys.length > 0 && (
              <div className="shc-keys">
                {f.keys.map((k) => (
                  <span key={k} className="shc-chip">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   LockLanesAnim — goroutines at locks. Each
   lane is one lock (one shard): who holds it,
   whether as a writer (alone) or readers (many
   at once), and who is queued behind it. Shows
   one big lock, read locks, sharding, and the
   read-lock bug where a "read" writes the map.
   ════════════════════════════════════════════ */

export type LockLane = {
  name: string;
  /** who holds the lock and how */
  mode?: "free" | "write" | "read";
  holders?: string[];
  waiting?: string[];
  /** a problem on this lane (a map written under a read lock) */
  bad?: string;
  /** keys this lane owns, shown small */
  keys?: string;
};

export type LockLanesFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  lanes: LockLane[];
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function LockLanesAnim({ title, frames, caption }: { title: string; frames: LockLanesFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2400);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="locks"
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
      <div className="lkl" key={st.cur}>
        {f.lanes.map((l) => (
          <div key={l.name} className={`lkl-lane lkl-${l.mode ?? "free"} ${l.bad ? "bad" : ""}`}>
            <div className="lkl-lock">
              <span className="lkl-icon">{l.mode === "write" ? "🔒" : l.mode === "read" ? "📖" : "🔓"}</span>
              <span className="lkl-name">{l.name}</span>
              {l.keys && <span className="lkl-keys">{l.keys}</span>}
            </div>
            <div className="lkl-holders">
              {(l.holders ?? []).map((h, i) => (
                <span key={h + i} className="lkl-g">
                  <Gopher role="worker" pose={l.bad ? "panic" : "carry"} state={l.bad ? "bad" : "active"} size={28} title={h} />
                  <span className="lkl-cmd">{h}</span>
                </span>
              ))}
            </div>
            <div className="lkl-queue">
              {(l.waiting ?? []).map((w, i) => (
                <span key={w + i} className="lkl-g lkl-wait">
                  <Gopher role="worker" pose="blocked" state="active" size={22} title={w} />
                  <span className="lkl-cmd">{w}</span>
                </span>
              ))}
            </div>
            {l.bad && <span className="lkl-bad">{l.bad}</span>}
          </div>
        ))}
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   ShutdownAnim — a server stopping. The door
   (the listener) closes; each connection shows
   the commands it has received but not run and
   the replies it owes; a deadline clock runs.
   Abrupt stop vs graceful drain vs a stuck client.
   ════════════════════════════════════════════ */

export type ShutdownConn = {
  name: string;
  state: "serving" | "idle" | "closed" | "stuck" | "cut";
  /** commands received, not yet run */
  inbox?: number;
  /** replies written back this frame */
  replies?: string;
};

export type ShutdownFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  door: "open" | "closed";
  signal?: string;
  clock?: string;
  conns: ShutdownConn[];
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function ShutdownAnim({ title, frames, caption }: { title: string; frames: ShutdownFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2400);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="shutdown"
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
      <div className="sdn" key={st.cur}>
        <div className="sdn-top">
          <span className={`sdn-door sdn-door-${f.door}`}>{f.door === "open" ? "🚪 accepting" : "⛔ not accepting"}</span>
          {f.signal && <span className="sdn-signal">{f.signal}</span>}
          {f.clock && <span className="sdn-clock">⏱ {f.clock}</span>}
        </div>
        <div className="sdn-conns">
          {f.conns.map((c) => (
            <div key={c.name} className={`sdn-conn sdn-${c.state}`}>
              <Gopher
                role="operator"
                pose={c.state === "serving" ? "carry" : c.state === "stuck" ? "blocked" : c.state === "cut" ? "panic" : c.state === "closed" ? "wave" : "sleep"}
                state={c.state === "cut" ? "bad" : "active"}
                size={30}
                title={c.name}
              />
              <span className="sdn-name">{c.name}</span>
              <span className="sdn-inbox">{c.inbox ? `${c.inbox} commands waiting` : ""}</span>
              {c.replies && <span className="shc-chip shc-ans">{c.replies}</span>}
              <span className="sdn-state">{c.state === "cut" ? "cut off" : c.state}</span>
            </div>
          ))}
        </div>
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   PubSubAnim — PUBLISH fanning a message out to
   every subscriber's queue. Each subscriber has a
   queue (a Go channel) drained by its writer; one
   that never reads fills up, and the publisher
   either waits on it or drops it.
   ════════════════════════════════════════════ */

export type PubSubSub = {
  name: string;
  /** messages waiting in its queue */
  queued: number;
  state?: "reading" | "stuck" | "dropped";
};

export type PubSubFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  channel: string;
  /** the message being published this frame */
  msg?: string;
  /** the publisher is blocked */
  blocked?: boolean;
  cap: number;
  subs: PubSubSub[];
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function PubSubAnim({ title, frames, caption }: { title: string; frames: PubSubFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2400);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="pub/sub"
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
      <div className="psb" key={st.cur}>
        <div className="psb-pub">
          <Gopher role="courier" pose={f.blocked ? "blocked" : f.msg ? "carry" : "idle"} state={f.blocked ? "bad" : "active"} size={42} title="the publisher" />
          <span className="shc-name">publisher</span>
          {f.msg && <span className="shc-chip">PUBLISH {f.channel} {f.msg}</span>}
          {f.blocked && <span className="psb-wait">waiting…</span>}
        </div>
        <div className="psb-hub">
          <span className="psb-ch">#{f.channel}</span>
        </div>
        <div className="psb-subs">
          {f.subs.map((s) => {
            const pct = Math.min(100, (s.queued / f.cap) * 100);
            return (
              <div key={s.name} className={`psb-sub psb-${s.state ?? "reading"}`}>
                <Gopher
                  role={s.state === "stuck" ? "worker" : "reader"}
                  look={s.name.endsWith("2") ? "pink" : undefined}
                  pose={s.state === "dropped" ? "exit" : s.state === "stuck" ? "sleep" : "happy"}
                  state="active"
                  size={26}
                  title={s.name}
                />
                <span className="psb-name">{s.name}</span>
                <span className="psb-q" title={`${s.queued} of ${f.cap} waiting`}>
                  <span className={`psb-fill ${pct >= 100 ? "full" : ""}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="psb-n">{s.state === "dropped" ? "dropped" : `${s.queued}/${f.cap}`}</span>
              </div>
            );
          })}
        </div>
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   DurabilityAnim — where a write lives on its way
   to disk: the process's buffer, the kernel's page
   cache, the disk itself. Shows what kill -9 and a
   power cut each destroy, when the reply is sent,
   and fsync (one per connection, or grouped).
   ════════════════════════════════════════════ */

export type DurabilityFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** commands sitting in each layer */
  buffer: string[];
  cache: string[];
  disk: string[];
  /** a reply the client has received */
  reply?: string;
  /** what just happened to the machine */
  event?: "kill -9" | "power cut" | "fsync" | "write()";
  /** layers wiped by the event */
  lost?: ("buffer" | "cache")[];
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function DurabilityAnim({ title, frames, caption }: { title: string; frames: DurabilityFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2600);
  const f = frames[st.cur] ?? frames[0];
  const layer = (key: "buffer" | "cache" | "disk", label: string, sub: string, items: string[]) => (
    <div className={`dur-layer dur-${key} ${f.lost?.includes(key as "buffer" | "cache") ? "dur-lost" : ""}`}>
      <div className="dur-head">
        <span className="dur-label">{label}</span>
        <span className="dur-sub">{sub}</span>
      </div>
      <div className="dur-items">
        {items.map((c, i) => (
          <span key={c + i} className="shc-chip">
            {c}
          </span>
        ))}
        {f.lost?.includes(key as "buffer" | "cache") && <span className="dur-x">gone</span>}
      </div>
    </div>
  );
  return (
    <AnimShell
      title={title}
      kicker="durability"
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
      <div className="dur" key={st.cur}>
        <div className="dur-client">
          <Gopher role="reader" pose={f.reply ? "happy" : "idle"} state="active" size={40} title="the client" />
          <span className="shc-name">client</span>
          {f.reply && <span className="shc-chip shc-ans">{f.reply}</span>}
        </div>
        <div className="dur-stack">
          {f.event && <span className={`dur-event ${f.event === "kill -9" || f.event === "power cut" ? "bad" : ""}`}>{f.event}</span>}
          {layer("buffer", "kv-server", "bufio.Writer, in the process", f.buffer)}
          {layer("cache", "kernel", "page cache, in RAM", f.cache)}
          {layer("disk", "disk", "kv.aof, on the drive", f.disk)}
        </div>
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   AofTapeAnim — the append-only file as a strip
   of records. Replay walks it with a cursor; a
   torn last record is cut off, damage in the
   middle stops the start, and a rewrite folds
   many records into one per key.
   ════════════════════════════════════════════ */

export type AofRecord = {
  label: string;
  kind?: "ok" | "torn" | "damaged" | "new" | "replayed";
};

export type AofTapeFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  file: string;
  records: AofRecord[];
  /** index of the record the replay cursor is on */
  cursor?: number;
  /** a verdict shown under the strip */
  verdict?: string;
  meters?: { label: string; value: string; tone?: "bad" | "good" }[];
};

export function AofTapeAnim({ title, frames, caption }: { title: string; frames: AofTapeFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2600);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="the file"
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
      <div className="aft" key={st.cur}>
        <div className="aft-head">
          <Gopher role="scribe" pose={f.cursor !== undefined ? "carry" : "idle"} state={f.beat === "problem" ? "bad" : "active"} size={36} title="replay" />
          <span className="aft-file">{f.file}</span>
        </div>
        <div className="aft-strip">
          {f.records.map((r, i) => (
            <span key={r.label + i} className={`aft-rec aft-${r.kind ?? "ok"} ${f.cursor === i ? "aft-at" : ""}`}>
              {r.label}
            </span>
          ))}
        </div>
        {f.verdict && <div className={`aft-verdict ${f.beat === "problem" ? "bad" : f.beat === "solution" ? "good" : ""}`}>{f.verdict}</div>}
      </div>
      {f.meters && (
        <div className="rtp-meters">
          {f.meters.map((m) => (
            <span key={m.label} className={`rtp-meter ${m.tone ?? ""}`}>
              {m.label} <b>{m.value}</b>
            </span>
          ))}
        </div>
      )}
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   FloatCentsAnim — what a float64 really holds.
   The price you typed, the 64 bits Go stored, the
   exact value those bits mean, the multiply, and
   int() chopping the fraction: a cent vanishes.
   Then the same price as integer cents.
   ════════════════════════════════════════════ */

export type FloatCentsFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** the Go expression being evaluated */
  expr: string;
  /** the float64's bits, if shown: sign, exponent, mantissa */
  bits?: [string, string, string];
  /** the exact decimal value the machine holds */
  exact?: string;
  /** what fmt.Println shows */
  printed?: string;
  /** the final integer, and whether it's right */
  result?: { value: string; ok: boolean };
};

export function FloatCentsAnim({ title, frames, caption }: { title: string; frames: FloatCentsFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2800);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="float64"
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
      <div className="flc" key={st.cur}>
        <div className="flc-left">
          <Gopher role="banker" pose={f.result ? (f.result.ok ? "happy" : "panic") : "idle"} state={f.result && !f.result.ok ? "bad" : "active"} size={48} title="the till" />
        </div>
        <div className="flc-rows">
          <div className="flc-row">
            <span className="flc-k">expression</span>
            <code className="flc-v flc-expr">{f.expr}</code>
          </div>
          {f.bits && (
            <div className="flc-row">
              <span className="flc-k">64 bits</span>
              <span className="flc-v flc-bits">
                <span className="flc-sign" title="sign">{f.bits[0]}</span>
                <span className="flc-exp" title="exponent">{f.bits[1]}</span>
                <span className="flc-man" title="mantissa">{f.bits[2]}</span>
              </span>
            </div>
          )}
          {f.exact && (
            <div className="flc-row">
              <span className="flc-k">exactly</span>
              <code className="flc-v">{f.exact}</code>
            </div>
          )}
          {f.printed && (
            <div className="flc-row">
              <span className="flc-k">Println</span>
              <code className="flc-v">{f.printed}</code>
            </div>
          )}
          {f.result && (
            <div className={`flc-result ${f.result.ok ? "ok" : "bad"}`}>
              {f.result.ok ? "✓" : "✗"} {f.result.value}
            </div>
          )}
        </div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   OnionAnim — decorators as nested layers. A call
   travels inward through each wrapper to the core
   and its result travels back out; a layer can
   answer early (a cache hit) and the inner ones
   never run.
   ════════════════════════════════════════════ */

export type OnionFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** index of the layer the call is at: 0 = outermost; layers.length = the core */
  at: number;
  dir: "in" | "out" | "idle";
  /** a note per layer for this frame, e.g. "start timer" */
  says?: Record<number, string>;
  /** layers skipped this call (the call never reached them) */
  skipped?: number[];
  result?: string;
};

export function OnionAnim({ title, layers, core, frames, caption }: { title: string; layers: string[]; core: string; frames: OnionFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2400);
  const f = frames[st.cur] ?? frames[0];
  const all = [...layers, core];
  const render = (i: number): ReactNode => {
    const here = f.at === i && f.dir !== "idle";
    const skipped = f.skipped?.includes(i);
    return (
      <div className={`onn-layer ${i === all.length - 1 ? "onn-core" : ""} ${here ? "onn-here" : ""} ${skipped ? "onn-skip" : ""}`}>
        <div className="onn-head">
          <span className="onn-name">{all[i]}</span>
          {here && <span className={`onn-arrow onn-${f.dir}`}>{f.dir === "in" ? "call →" : "← result"}</span>}
          {f.says?.[i] && <span className="onn-says">{f.says[i]}</span>}
        </div>
        {i < all.length - 1 && render(i + 1)}
      </div>
    );
  };
  return (
    <AnimShell
      title={title}
      kicker="decorators"
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
      <div className="onn" key={st.cur}>
        <div className="onn-caller">
          <Gopher role="operator" pose={f.result ? "happy" : f.dir === "in" ? "carry" : "idle"} state="active" size={40} title="the caller" />
          <span className="shc-name">caller</span>
          {f.result && <span className="shc-chip shc-ans">{f.result}</span>}
        </div>
        <div className="onn-stack">{render(0)}</div>
      </div>
    </AnimShell>
  );
}

/* ════════════════════════════════════════════
   IfaceWordsAnim — an interface value as the two
   machine words it really is, with the addresses
   read from a running program: word 1 points at
   the type's method table (itab), word 2 at the
   data. nil means both words are zero.
   ════════════════════════════════════════════ */

export type IfaceWordsFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  expr: string;
  /** the two words as printed */
  words: [string, string];
  /** what each word points to, if anything */
  points?: [string | null, string | null];
  /** err != nil */
  check?: boolean;
  /** what fmt prints for it */
  printed?: string;
};

export function IfaceWordsAnim({ title, frames, caption }: { title: string; frames: IfaceWordsFrame[]; caption?: string }) {
  const st = useStepper(frames.length, 2800);
  const f = frames[st.cur] ?? frames[0];
  return (
    <AnimShell
      title={title}
      kicker="interface words"
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
      <div className="ifw" key={st.cur}>
        <code className="ifw-expr">{f.expr}</code>
        <div className="ifw-grid">
          {(["word 1 · type (itab)", "word 2 · data"] as const).map((label, i) => (
            <div key={label} className={`ifw-word ${f.words[i] === "0x0" ? "ifw-zero" : "ifw-set"}`}>
              <span className="ifw-label">{label}</span>
              <code className="ifw-hex">{f.words[i]}</code>
              {f.points?.[i] && <span className="ifw-points">→ {f.points[i]}</span>}
            </div>
          ))}
        </div>
        <div className="ifw-out">
          {f.check !== undefined && (
            <span className={`rtp-meter ${f.beat === "problem" ? "bad" : f.beat === "solution" ? "good" : ""}`}>
              err != nil <b>{String(f.check)}</b>
            </span>
          )}
          {f.printed && (
            <span className="rtp-meter">
              fmt prints <b>{f.printed}</b>
            </span>
          )}
          <Gopher role="detective" pose={f.beat === "problem" ? "panic" : f.beat === "solution" ? "happy" : "idle"} state={f.beat === "problem" ? "bad" : "active"} size={34} title="the caller's nil check" />
        </div>
      </div>
    </AnimShell>
  );
}
