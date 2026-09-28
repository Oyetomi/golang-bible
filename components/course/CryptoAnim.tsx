"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Gopher, type GopherRole } from "./Gopher";
import "./crypto-anim.css";

/* ════════════════════════════════════════════════════════════════════
   CryptoAnim — two bespoke pictures for the payments-security chapter.

   EnvelopeAnim: envelope encryption as it really runs. The card vault
   (a gopher at a counter) holds a card number, asks Vault's KMS for a
   data key, seals the number with AES-256-GCM (nonce + token as AAD),
   and writes the ciphertext to `cards` and the wrapped key to `deks`.
   The KEK lives in Vault with its versions; rotation rewraps keys in
   `deks` and leaves `cards` alone.

   SignAnim: an HMAC-signed API request. The request card, with every
   signed field, slides from the merchant across the internet to the
   API; both sides hold the secret, which never travels; the API
   recomputes the signature, compares, checks the clock and claims the
   nonce in Redis.

   Both are frame-stepped like the other mental-model animations.
   ════════════════════════════════════════════════════════════════════ */

type Beat = "problem" | "solution" | "neutral";
const SPEEDS = [1, 0.5, 2] as const;

function useSteps(total: number, ms: number) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
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
    cycle: () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]),
    reset: () => {
      setPlaying(false);
      setCur(0);
    },
    step: () => {
      setPlaying(false);
      setCur((c) => Math.min(total - 1, c + 1));
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

function Shell({
  title,
  kicker,
  note,
  beat,
  st,
  total,
  caption,
  children,
}: {
  title: string;
  kicker: string;
  note: ReactNode;
  beat: Beat;
  st: ReturnType<typeof useSteps>;
  total: number;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="anim cx">
      <div className="anim-head">
        <span className="anim-kicker">{kicker}</span>
        <span className="anim-title">{title}</span>
        <div className="anim-ctrls">
          <button className="anim-btn" onClick={st.cycle} aria-label="Playback speed" title="Playback speed">
            {st.speed === 0.5 ? "½×" : `${st.speed}×`}
          </button>
          <button className="anim-btn" onClick={st.reset} aria-label="Reset" title="Reset">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button className="anim-btn" onClick={st.step} aria-label="Step forward" title="Step forward">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
          <button className="anim-btn anim-play" onClick={st.toggle}>
            {st.playing ? "Pause" : st.cur >= total - 1 ? "Replay" : "Play"}
          </button>
        </div>
      </div>
      <div className="anim-stage cx-stage">{children}</div>
      <div className={`anim-note anim-beat-${beat}`}>
        <span className="anim-frameno">
          {st.cur + 1}/{total}
        </span>
        <span>{note}</span>
      </div>
      <div className="anim-dots">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} className={`anim-dot ${i === st.cur ? "on" : ""} ${i < st.cur ? "past" : ""}`} onClick={() => st.go(i)} aria-label={`Step ${i + 1}`} />
        ))}
      </div>
      {caption && <figcaption className="anim-cap">{caption}</figcaption>}
    </figure>
  );
}

/* A key drawn as a key: bow, shaft and teeth, with a label. */
function KeyChip({ label, sub, tone = "dek", state }: { label: string; sub?: string; tone?: "dek" | "kek" | "secret"; state?: string }) {
  return (
    <span className={`cx-key cx-key-${tone} ${state ?? ""}`}>
      <svg viewBox="0 0 40 16" width="34" height="14" aria-hidden>
        <circle cx="7" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M12 8 H37 M30 8 V13 M35 8 V12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="cx-key-l">{label}</span>
      {sub && <span className="cx-key-s">{sub}</span>}
    </span>
  );
}

/* ── EnvelopeAnim ──────────────────────────────────────────────────── */

export type EnvRow = { token: string; nonce?: string; pan: string; dek: string; state?: "new" | "bad" | "same" | "ok" };
export type EnvDek = { id: string; wrapped: string; state?: "new" | "hot" | "bad" };
export type EnvKek = { v: number; state?: "active" | "retired" | "new" };
export type EnvFrame = {
  note: string;
  beat?: Beat;
  say?: string;
  mood?: "ok" | "bad" | "wait";
  /** the card number on the counter, in the clear */
  card?: string;
  /** hex bytes shown once the card is sealed */
  sealed?: string;
  /** the data key the gopher holds in memory */
  dek?: string;
  nonce?: string;
  aad?: string;
  /** traffic between the service and Vault, or the database */
  flow?: { to: "vault" | "db"; dir: "out" | "in" | "both"; label: string } | null;
  kek?: EnvKek[];
  rows?: EnvRow[];
  deks?: EnvDek[];
  result?: { text: string; ok: boolean };
};

export function EnvelopeAnim({
  title,
  kicker = "envelope encryption",
  frames,
  role = "guard",
  caption,
}: {
  title: string;
  kicker?: string;
  frames: EnvFrame[];
  role?: GopherRole;
  caption?: string;
}) {
  const st = useSteps(frames.length, 2600);
  const f = frames[st.cur] ?? frames[0];
  const kek = f.kek ?? [{ v: 1, state: "active" }];
  const flowV = f.flow?.to === "vault" ? f.flow : null;
  const flowD = f.flow?.to === "db" ? f.flow : null;
  const digits = (f.card ?? "").replace(/\s/g, "");
  const sealed = (f.sealed ?? "").match(/.{1,2}/g) ?? [];
  return (
    <Shell title={title} kicker={kicker} note={f.note} beat={f.beat ?? "neutral"} st={st} total={frames.length} caption={caption}>
      <div className="cx-env">
        <section className="cx-zone cx-svc">
          <span className="cx-zlabel">card vault · Go · memory</span>
          <div className="cx-sayline">{f.say && <span key={f.say} className={`cx-bubble ${f.mood ?? ""}`}>{f.say}</span>}</div>
          <div className="cx-desk">
            <div className="cx-op">
              <Gopher role={role} size={46} pose={f.mood === "bad" ? "panic" : f.mood === "ok" ? "happy" : f.flow ? "carry" : "idle"} state={f.mood === "bad" ? "bad" : f.mood === "ok" ? "done" : "active"} title="the card vault" />
            </div>
            <div className="cx-bench">
              <div className={`cx-card ${f.sealed ? "is-sealed" : ""} ${f.card || f.sealed ? "" : "is-empty"}`}>
                <span className="cx-cap">{f.sealed ? "ciphertext + tag" : "card number"}</span>
                <div className="cx-cells">
                  {f.sealed
                    ? sealed.map((b, i) => (
                        <span key={"s" + i} className="cx-cell ct" style={{ animationDelay: `${i * 22}ms` }}>
                          {b}
                        </span>
                      ))
                    : digits.split("").map((d, i) => (
                        <span key={"d" + i} className={`cx-cell pt ${i % 4 === 3 ? "gap" : ""}`}>
                          {d}
                        </span>
                      ))}
                  {!f.card && !f.sealed && <span className="cx-none">—</span>}
                </div>
              </div>
              <div className={`cx-gcm ${f.sealed || f.aad ? "on" : ""} ${f.result && !f.result.ok ? "bad" : ""}`}>
                <span className="cx-gcm-t">AES-256-GCM</span>
                <span className="cx-gcm-in">
                  <b>key</b> {f.dek ? "DEK" : "—"}
                </span>
                <span className="cx-gcm-in">
                  <b>nonce</b> {f.nonce ?? "—"}
                </span>
                <span className="cx-gcm-in">
                  <b>aad</b> {f.aad ?? "—"}
                </span>
              </div>
              <div className="cx-mem">{f.dek ? <KeyChip label={f.dek} sub="plaintext · RAM only" tone="dek" state="hot" /> : <span className="cx-none">no data key in memory</span>}</div>
            </div>
          </div>
          {f.result && <div className={`cx-result ${f.result.ok ? "ok" : "bad"}`}>{f.result.text}</div>}
        </section>

        <div className={`cx-flow cx-flow-v ${flowV ? `on ${flowV.dir}` : ""}`} aria-hidden={!flowV}>
          <span className="cx-flow-line" />
          {flowV && <span className="cx-flow-l">{flowV.label}</span>}
        </div>

        <section className="cx-zone cx-kms">
          <span className="cx-zlabel">Vault · transit key “cards”</span>
          <div className="cx-kek">
            {kek.map((k) => (
              <KeyChip key={k.v} label={`KEK v${k.v}`} sub={k.state === "retired" ? "retired" : k.state === "new" ? "new" : "active"} tone="kek" state={k.state ?? "active"} />
            ))}
          </div>
          <span className="cx-lock">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            the KEK never leaves Vault
          </span>
        </section>

        <div className={`cx-flow cx-flow-d ${flowD ? `on ${flowD.dir}` : ""}`} aria-hidden={!flowD}>
          <span className="cx-flow-line" />
          {flowD && <span className="cx-flow-l">{flowD.label}</span>}
        </div>

        <section className="cx-zone cx-db">
          <span className="cx-zlabel">Postgres</span>
          <div className="cx-tables">
            <div className="cx-table">
              <span className="cx-tname">cards</span>
              <div className="cx-tr cx-th">
                <span>token</span>
                <span>nonce</span>
                <span>pan</span>
                <span>dek</span>
              </div>
              {(f.rows ?? []).map((r) => (
                <div key={r.token} className={`cx-tr ${r.state ?? ""}`}>
                  <span>{r.token}</span>
                  <span>{r.nonce ?? "…"}</span>
                  <span>{r.pan}</span>
                  <span>{r.dek}</span>
                </div>
              ))}
              {(f.rows ?? []).length === 0 && <div className="cx-tr cx-empty">no rows</div>}
            </div>
            <div className="cx-table cx-table-deks">
              <span className="cx-tname">deks</span>
              <div className="cx-tr cx-th">
                <span>id</span>
                <span>wrapped</span>
              </div>
              {(f.deks ?? []).map((d) => (
                <div key={d.id} className={`cx-tr ${d.state ?? ""}`}>
                  <span>{d.id}</span>
                  <span>{d.wrapped}</span>
                </div>
              ))}
              {(f.deks ?? []).length === 0 && <div className="cx-tr cx-empty">no rows</div>}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

/* ── SignAnim ──────────────────────────────────────────────────────── */

export type SignField = { k: string; v: string; state?: "bad" | "hot" };
export type SignFrame = {
  note: string;
  beat?: Beat;
  /** where the request is */
  at: "client" | "wire" | "server";
  fields?: SignField[];
  /** the signature the request carries */
  sig?: string;
  /** what the server computes, and whether they match */
  want?: string;
  match?: boolean;
  clock?: string;
  clockBad?: boolean;
  nonces?: string[];
  claim?: { nonce: string; ok: boolean };
  status?: { code: number; text: string };
  clientSay?: string;
  serverSay?: string;
  serverMood?: "ok" | "bad" | "wait";
};

export function SignAnim({
  title,
  kicker = "signed requests",
  client = "Acme's server",
  server = "Meridian API",
  clientRole = "operator",
  clientLook,
  serverRole = "guard",
  frames,
  caption,
}: {
  title: string;
  kicker?: string;
  client?: string;
  server?: string;
  clientRole?: GopherRole;
  clientLook?: "pink";
  serverRole?: GopherRole;
  frames: SignFrame[];
  caption?: string;
}) {
  const st = useSteps(frames.length, 2600);
  const f = frames[st.cur] ?? frames[0];
  const fields = f.fields ?? [];
  const pos = f.at === "client" ? 0 : f.at === "wire" ? 0.5 : 1;
  return (
    <Shell title={title} kicker={kicker} note={f.note} beat={f.beat ?? "neutral"} st={st} total={frames.length} caption={caption}>
      <div className="cx-sign">
        <div className="cx-ends">
          <div className="cx-end">
            {f.clientSay && <span className="cin-say">{f.clientSay}</span>}
            <Gopher role={clientRole} look={clientLook} size={40} pose={f.at === "client" ? "carry" : "idle"} state="active" title={client} />
            <span className="cx-endname">{client}</span>
            <KeyChip label="secret" sub="never sent" tone="secret" />
          </div>
          <div className="cx-wire">
            <span className="cx-wire-l">the internet</span>
          </div>
          <div className="cx-end">
            {f.serverSay && <span className={`cin-say ${f.serverMood ?? ""}`}>{f.serverSay}</span>}
            <Gopher
              role={serverRole}
              size={40}
              pose={f.serverMood === "bad" ? "blocked" : f.serverMood === "ok" ? "happy" : "idle"}
              state={f.serverMood === "bad" ? "bad" : f.serverMood === "ok" ? "done" : "active"}
              flip
              title={server}
            />
            <span className="cx-endname">{server}</span>
            <KeyChip label="secret" sub="looked up by key id" tone="secret" />
          </div>
        </div>

        <div className="cx-track">
          <div className="cx-req" style={{ left: `calc(${pos} * (100% - var(--req-w)))` }}>
            <span className="cx-req-t">request</span>
            {fields.map((x) => (
              <div key={x.k} className={`cx-field ${x.state ?? ""}`}>
                <b>{x.k}</b>
                <span>{x.v}</span>
              </div>
            ))}
            {f.sig && (
              <div className="cx-field sig">
                <b>signature</b>
                <span>{f.sig}</span>
              </div>
            )}
          </div>
        </div>

        <div className="cx-checks">
          <div className={`cx-check ${f.clock ? (f.clockBad ? "bad" : "ok") : ""}`}>
            <span className="cx-check-t">1 · clock</span>
            <span>{f.clock ?? "—"}</span>
          </div>
          <div className={`cx-check ${f.want ? (f.match ? "ok" : "bad") : ""}`}>
            <span className="cx-check-t">2 · HMAC-SHA256 recomputed</span>
            <span>{f.want ?? "—"}</span>
            {f.want && <span className="cx-eq">{f.match ? "hmac.Equal ✓" : "hmac.Equal ✗"}</span>}
          </div>
          <div className={`cx-check ${f.claim ? (f.claim.ok ? "ok" : "bad") : ""}`}>
            <span className="cx-check-t">3 · Redis · nonces seen</span>
            <div className="cx-nonces">
              {(f.nonces ?? []).map((n) => (
                <span key={n} className={`cx-nonce ${f.claim?.nonce === n ? (f.claim.ok ? "new" : "dup") : ""}`}>
                  {n}
                </span>
              ))}
              {(f.nonces ?? []).length === 0 && <span className="cx-none">empty</span>}
            </div>
            {f.claim && <span className="cx-eq">{f.claim.ok ? "SET NX → OK" : "SET NX → nil"}</span>}
          </div>
          {f.status && <div className={`cx-status ${f.status.code < 300 ? "ok" : "bad"}`}>{f.status.code} {f.status.text}</div>}
        </div>
      </div>
    </Shell>
  );
}
