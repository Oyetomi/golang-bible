"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Gopher, type GopherRole } from "./Gopher";
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
          <button className="anim-btn" onClick={onReset} aria-label="Reset">
            ⤺
          </button>
          <button className="anim-btn" onClick={onStep} aria-label="Step forward">
            ⏭
          </button>
          <button className="anim-btn anim-play" onClick={onToggle}>
            {playing ? "❚❚ Pause" : "▶ Play"}
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
