"use client";

import { useEffect, useRef, useState } from "react";
import { Gopher } from "./Gopher";
import { SPEEDS, speedLabel } from "./client";
import "./procanim.css";

/* ════════════════════════════════════════════════════════════════════
   ProcAnim — a Go service as the Linux kernel sees it.

   Left: the process tree, one card per process (PID, name, state letter:
   R running, S sleeping, Z zombie), children indented under their
   parent, with the kernel gopher narrating. A signal arrives as an
   envelope from its sender (docker stop, systemd, the OOM killer) and
   lands on its target, marked caught, ignored or killed.
   Right, when a frame has one: the process's file descriptor table
   (fd number → what it points at, and a gauge of open fds against
   RLIMIT_NOFILE), or its cgroup's memory gauge (memory.current against
   memory.max, with GOMEMLIMIT drawn as a dashed soft line).
   ════════════════════════════════════════════════════════════════════ */

export type ProcNode = {
  pid: string;
  name: string;
  /** the parent's pid; children are drawn under their parent */
  parent?: string;
  /** R running, S sleeping, Z zombie, gone: reaped or never existed */
  state?: "R" | "S" | "Z" | "gone";
  /** a short tag after the name, e.g. "PID 1" or "tini" */
  tag?: string;
  hot?: boolean;
  bad?: boolean;
};

export type FdRow = {
  fd: number | string;
  what: string;
  kind?: "std" | "file" | "sock" | "pipe" | "rt" | "leak" | "more";
};

export type ProcSignal = {
  sig: string;
  /** who sends it, e.g. "docker stop" */
  from: string;
  /** target pid */
  to: string;
  result?: "caught" | "ignored" | "killed" | "pending";
};

export type ProcFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** the command being run, shown as a terminal line */
  code?: string;
  procs?: ProcNode[];
  /** the kernel gopher's speech bubble */
  say?: string;
  sig?: ProcSignal;
  fds?: { title: string; rows: FdRow[]; open?: number; limit?: number };
  mem?: { title?: string; used: number; max: number; soft?: number; heap?: number; killed?: boolean; unit?: string };
  /** what the parent (or docker, or systemd) reports at the end, e.g. "exit code 143" */
  exit?: string;
};

function depthOf(p: ProcNode, byPid: Map<string, ProcNode>): number {
  let d = 0;
  let cur = p;
  while (cur.parent && byPid.has(cur.parent) && d < 6) {
    cur = byPid.get(cur.parent)!;
    d++;
  }
  return d;
}

/* order: each parent followed by its children, depth first */
function treeOrder(procs: ProcNode[]): ProcNode[] {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const out: ProcNode[] = [];
  const visit = (p: ProcNode) => {
    out.push(p);
    procs.filter((c) => c.parent === p.pid).forEach(visit);
  };
  procs.filter((p) => !p.parent || !byPid.has(p.parent)).forEach(visit);
  return out;
}

const STATE_WORD: Record<string, string> = { R: "running", S: "sleeping", Z: "zombie", gone: "gone" };
const RESULT_WORD: Record<string, string> = { caught: "handler runs", ignored: "ignored", killed: "killed", pending: "on its way" };

export function ProcAnim({
  title,
  kicker = "the kernel's view",
  frames,
  caption,
  ms = 2600,
}: {
  title: string;
  kicker?: string;
  frames: ProcFrame[];
  caption?: string;
  /** time per frame when playing, at 1× */
  ms?: number;
}) {
  const total = frames.length;
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
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

  const f = frames[cur] ?? frames[0];
  const procs = f.procs ?? [];
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const ordered = treeOrder(procs);
  const side = f.fds ? "fds" : f.mem ? "mem" : null;
  const unit = f.mem?.unit ?? " MiB";

  return (
    <figure className="anim procanim">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          <button className="anim-btn" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])} aria-label="Playback speed" title="Playback speed">
            {speedLabel(speed)}
          </button>
          <button className="anim-btn" onClick={() => { setPlaying(false); setCur(0); }} aria-label="Reset" title="Reset">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button className="anim-btn" onClick={() => { setPlaying(false); setCur((c) => Math.min(c + 1, total - 1)); }} aria-label="Step forward" title="Step forward">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
          <button
            className="anim-btn anim-play"
            onClick={() => {
              if (cur >= total - 1) setCur(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>

      <div className="pa-stage">
        {f.code && (
          <div className="pa-term" key={"code" + cur}>
            <span className="pa-prompt">$</span> {f.code}
          </div>
        )}
        <div className={`pa-grid ${side ? "two" : "one"}`}>
          <div className="pa-panel pa-tree">
            <div className="pa-kernel">
              <Gopher role="kernel" pose={f.beat === "problem" ? "panic" : f.beat === "solution" ? "happy" : "idle"} state={f.beat === "problem" ? "bad" : "active"} size={40} title="the kernel" />
              <div className="pa-kernel-text">
                <span className="pa-k">kernel</span>
                {f.say && <span className="pa-say" key={"say" + cur}>{f.say}</span>}
              </div>
            </div>
            {f.sig && (
              <div className={`pa-sender ${f.sig.result ?? "pending"}`} key={"snd" + cur}>
                <span className="pa-from">{f.sig.from}</span>
                <span className="pa-wire" aria-hidden>
                  <span className="pa-env">{f.sig.sig}</span>
                </span>
                <span className="pa-to">PID {f.sig.to}</span>
              </div>
            )}
            <ul className="pa-procs">
              {ordered.map((p) => {
                const d = depthOf(p, byPid);
                const st = p.state ?? "S";
                const hit = f.sig && f.sig.to === p.pid ? f.sig : null;
                return (
                  <li
                    key={p.pid}
                    className={`pa-proc st-${st} ${p.hot ? "hot" : ""} ${p.bad ? "bad" : ""}`}
                    style={{ marginLeft: `${d * 22}px` }}
                  >
                    {d > 0 && <span className="pa-elbow" aria-hidden />}
                    <span className="pa-pid">{p.pid}</span>
                    <span className="pa-name">{p.name}</span>
                    {p.tag && <span className="pa-tag">{p.tag}</span>}
                    <span className={`pa-state st-${st}`} title={STATE_WORD[st]}>
                      {st === "gone" ? "gone" : `${st} · ${STATE_WORD[st]}`}
                    </span>
                    {hit && (
                      <span className={`pa-hit ${hit.result ?? "pending"}`} key={"hit" + cur}>
                        {hit.sig} → {RESULT_WORD[hit.result ?? "pending"]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {f.exit && <div className="pa-exit" key={"exit" + cur}>{f.exit}</div>}
          </div>

          {side === "fds" && f.fds && (
            <div className="pa-panel pa-fds">
              <div className="pa-ptitle">{f.fds.title}</div>
              <ul className="pa-fdrows">
                {f.fds.rows.map((r, i) => (
                  <li key={`${r.fd}-${i}`} className={`pa-fd k-${r.kind ?? "file"}`}>
                    <span className="pa-fdn">{r.fd}</span>
                    <span className="pa-fdarrow" aria-hidden>→</span>
                    <span className="pa-fdwhat">{r.what}</span>
                  </li>
                ))}
              </ul>
              {f.fds.open !== undefined && f.fds.limit !== undefined && (
                <div className={`pa-gauge h ${f.fds.open >= f.fds.limit ? "full" : f.fds.open > f.fds.limit * 0.6 ? "warn" : ""}`}>
                  <div className="pa-gbar">
                    <div className="pa-gfill" style={{ width: `${Math.min(100, (f.fds.open / f.fds.limit) * 100)}%` }} />
                  </div>
                  <span className="pa-glabel">
                    {f.fds.open.toLocaleString("en-US")} of {f.fds.limit.toLocaleString("en-US")} open files
                  </span>
                </div>
              )}
            </div>
          )}

          {side === "mem" && f.mem && (
            <div className="pa-panel pa-mem">
              <div className="pa-ptitle">{f.mem.title ?? "the container's cgroup"}</div>
              <div className="pa-memwrap">
                <div className={`pa-vgauge ${f.mem.killed ? "killed" : f.mem.used >= f.mem.max ? "full" : ""}`}>
                  <div className="pa-vfill" style={{ height: `${Math.min(100, (f.mem.used / f.mem.max) * 100)}%` }} />
                  {f.mem.heap !== undefined && (
                    <div className="pa-vheap" style={{ height: `${Math.min(100, (f.mem.heap / f.mem.max) * 100)}%` }} />
                  )}
                  {f.mem.soft !== undefined && (
                    <div className="pa-vsoft" style={{ bottom: `${Math.min(100, (f.mem.soft / f.mem.max) * 100)}%` }}>
                      <span>GOMEMLIMIT {f.mem.soft}{unit}</span>
                    </div>
                  )}
                  <div className="pa-vmax">
                    <span>memory.max {f.mem.max}{unit}</span>
                  </div>
                  {f.mem.killed && <span className="pa-stamp">OOM kill</span>}
                </div>
                <div className="pa-memlegend">
                  <span><i className="sw used" /> memory.current <b>{f.mem.used}{unit}</b></span>
                  {f.mem.heap !== undefined && (
                    <span><i className="sw heap" /> Go heap <b>{f.mem.heap}{unit}</b></span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`anim-note anim-beat-${f.beat ?? "neutral"}`}>
        <span className="anim-frameno">
          {cur + 1}/{total}
        </span>
        <span>{f.note}</span>
      </div>
      <div className="anim-dots">
        {frames.map((_, i) => (
          <button
            key={i}
            className={`anim-dot ${i === cur ? "on" : ""} ${i < cur ? "past" : ""}`}
            onClick={() => {
              setPlaying(false);
              setCur(i);
            }}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      {caption && <figcaption className="anim-cap">{caption}</figcaption>}
    </figure>
  );
}
