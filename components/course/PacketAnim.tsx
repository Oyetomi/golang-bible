"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Gopher, type GopherRole } from "./Gopher";
import "./packetanim.css";

/* ════════════════════════════════════════════════════════════════════
   PacketAnim — one packet's trip through a network, hop by hop.

   The stage is a small map: subnets drawn as dashed zones, machines and
   network devices (client, DNS server, load balancer, router, bridge,
   pod) as boxes, cables between them. Each frame moves the packet along
   one cable (from → to), and the header inspector under the map shows
   the packet's addresses as they are at that moment: when NAT rewrites
   a source or destination, the old value is struck through beside the
   new one. A gopher stands at the hop that is handling the packet.
   Frames can also carry the tcpdump line that the real run printed.
   ════════════════════════════════════════════════════════════════════ */

export type PacketHop = {
  id: string;
  label: string;
  /** a second line: an address, a port, an interface */
  sub?: string;
  /** centre, as a percentage of the stage's width and height */
  x: number;
  y: number;
  kind?: "client" | "dns" | "lb" | "router" | "bridge" | "pod" | "server" | "internet" | "nat";
  role?: GopherRole;
};

export type PacketZone = {
  id: string;
  label: string;
  /** top-left corner and size, as percentages of the stage */
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: "public" | "private" | "host" | "internet";
};

export type PacketLink = { from: string; to: string; label?: string; dashed?: boolean };

export type PacketHeader = {
  src?: string;
  dst?: string;
  /** protocol and flags: "UDP · DNS query", "TCP · SYN" */
  proto?: string;
  /** what the packet carries, in a few words */
  body?: string;
};

export type PacketFrame = {
  note: string;
  beat?: "problem" | "solution" | "neutral";
  /** the packet travels from → to in this frame; without from it sits at to */
  from?: string;
  to?: string;
  /** a short label on the packet itself: "SYN", "A?", "GET /" */
  tag?: string;
  pkt?: PacketHeader;
  /** earlier values of fields this frame rewrote (NAT), shown struck through */
  was?: { src?: string; dst?: string };
  /** the packet is dropped at `to` */
  lost?: boolean;
  /** hop, link ("a>b") or zone ids lit up in this frame */
  hot?: string[];
  /** ids drawn as broken */
  bad?: string[];
  /** where the gopher stands (default: to), and what it says */
  at?: string;
  say?: string;
  /** the line tcpdump printed for this packet in the real run */
  dump?: string;
};

const W = 720;
const SPEEDS = [1, 0.5, 2] as const;

export function PacketAnim({
  title,
  kicker = "a packet's journey",
  hops,
  zones = [],
  links = [],
  frames,
  role = "operator",
  height = 46,
  caption,
}: {
  title: string;
  kicker?: string;
  hops: PacketHop[];
  zones?: PacketZone[];
  links?: PacketLink[];
  frames: PacketFrame[];
  role?: GopherRole;
  /** stage height as a percentage of its width */
  height?: number;
  caption?: string;
}) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [scale, setScale] = useState(1);
  const wrap = useRef<HTMLDivElement>(null);
  const H = (height / 100) * W;
  const total = frames.length;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCur((c) => {
        if (c >= total - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 2600 / speed);
    return () => clearInterval(id);
  }, [playing, speed, total]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // shrink the map to fit, but not below 0.6: past that, scroll it sideways
    const ro = new ResizeObserver(([e]) => setScale(Math.max(0.6, Math.min(1, e.contentRect.width / W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const f = frames[cur] ?? frames[0];
  const byId = new Map(hops.map((h) => [h.id, h]));
  const px = (h: PacketHop) => ({ x: (h.x / 100) * W, y: (h.y / 100) * H });
  const to = f.to ? byId.get(f.to) : undefined;
  const from = f.from ? byId.get(f.from) : undefined;
  const at = byId.get(f.at ?? f.to ?? "");
  const lit = (id: string) => f.hot?.includes(id);
  const broken = (id: string) => f.bad?.includes(id);
  const moving = from && to ? `${from.id}>${to.id}` : "";

  // the packet's pill, sitting a little above the hop's centre
  const end = to ? px(to) : null;
  const start = from ? px(from) : end;
  const pktStyle = end
    ? ({
        "--x0": `${start!.x}px`,
        "--y0": `${start!.y - 30}px`,
        "--x1": `${end.x}px`,
        "--y1": `${end.y - 30}px`,
      } as CSSProperties)
    : undefined;

  const toggle = () => {
    if (cur >= total - 1) setCur(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="anim pk">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          <button className="anim-btn" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed" title="Playback speed">
            {speed === 0.5 ? "½×" : `${speed}×`}
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
          <button className="anim-btn anim-play" onClick={toggle}>
            {playing ? "Pause" : cur >= total - 1 && cur > 0 ? "Replay" : "Play"}
          </button>
        </div>
      </div>

      <div className="pk-scroll" ref={wrap}>
        <div className="pk-viewport" style={{ width: W * scale, height: H * scale }}>
          <div className="pk-world" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            {zones.map((z) => (
              <div
                key={z.id}
                className={`pk-zone pk-zone-${z.kind ?? "host"} ${lit(z.id) ? "hot" : ""} ${broken(z.id) ? "bad" : ""}`}
                style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
              >
                <span className="pk-zlabel">{z.label}</span>
              </div>
            ))}

            <svg className="pk-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden>
              {links.map((l) => {
                const a = byId.get(l.from);
                const b = byId.get(l.to);
                if (!a || !b) return null;
                const id = `${l.from}>${l.to}`;
                const rid = `${l.to}>${l.from}`;
                const A = px(a), B = px(b);
                const on = moving === id || moving === rid || lit(id) || lit(rid);
                return (
                  <g key={id} className={`pk-link ${on ? "hot" : ""} ${broken(id) || broken(rid) ? "bad" : ""} ${l.dashed ? "dashed" : ""}`}>
                    <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
                    {l.label && (
                      <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 + 20} textAnchor="middle">
                        {l.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {hops.map((h) => (
              <div
                key={h.id}
                className={`pk-hop pk-${h.kind ?? "server"} ${lit(h.id) ? "hot" : ""} ${broken(h.id) ? "bad" : ""} ${f.to === h.id ? "here" : ""}`}
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
              >
                <span className="pk-hlabel">{h.label}</span>
                {h.sub && <span className="pk-hsub">{h.sub}</span>}
              </div>
            ))}

            {at && (
              <div className="pk-gopher" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                {f.say && <span className="pk-say">{f.say}</span>}
                <Gopher
                  role={at.role ?? role}
                  pose={f.lost || f.beat === "problem" ? "blocked" : f.beat === "solution" ? "happy" : from ? "carry" : "idle"}
                  state={f.lost || f.beat === "problem" ? "bad" : f.beat === "solution" ? "ok" : "active"}
                  size={34}
                />
              </div>
            )}

            {end && f.tag && (
              <div key={`p${cur}`} className={`pk-packet ${from ? "fly" : ""} ${f.lost ? "lost" : ""} ${f.was ? "rewritten" : ""}`} style={pktStyle}>
                <span className="pk-env" aria-hidden />
                <span className="pk-tag">{f.tag}</span>
                {f.lost && <span className="pk-x" aria-hidden>✕</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {(f.pkt || f.dump) && (
        <div className={`pk-inspect ${f.was ? "rewritten" : ""}`}>
          {f.pkt && (
            <div className="pk-fields">
              {(["src", "dst"] as const).map((k) =>
                f.pkt![k] ? (
                  <div key={k} className={`pk-field ${f.was?.[k] ? "changed" : ""}`}>
                    <span className="pk-fk">{k === "src" ? "source" : "destination"}</span>
                    <span className="pk-fv">
                      {f.was?.[k] && <s>{f.was[k]}</s>}
                      {f.pkt![k]}
                    </span>
                  </div>
                ) : null
              )}
              {f.pkt.proto && (
                <div className="pk-field">
                  <span className="pk-fk">protocol</span>
                  <span className="pk-fv">{f.pkt.proto}</span>
                </div>
              )}
              {f.pkt.body && (
                <div className="pk-field">
                  <span className="pk-fk">carrying</span>
                  <span className="pk-fv">{f.pkt.body}</span>
                </div>
              )}
            </div>
          )}
          {f.dump && (
            <div className="pk-dump">
              <span className="pk-fk">tcpdump saw</span>
              <code>{f.dump}</code>
            </div>
          )}
        </div>
      )}

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
            onClick={() => { setPlaying(false); setCur(i); }}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      {caption && <figcaption className="anim-cap">{caption}</figcaption>}
    </figure>
  );
}
