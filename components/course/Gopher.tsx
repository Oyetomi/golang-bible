import type { CSSProperties } from "react";

/* ──────────────────────────────────────────────
   The course mascot: a simplified, geometric Go
   gopher built from a handful of SVG shapes so it
   stays crisp at 24–64px and is cheap to animate
   (all motion is CSS keyframes on named parts).

   Inspired by the Go gopher designed by Renée
   French (CC BY 4.0) — attributed site-wide.
   ────────────────────────────────────────────── */

export type GopherPose =
  | "idle" // gentle bob — default standing
  | "run" // leaning, feet scurrying
  | "carry" // arms up, holding a payload box overhead
  | "blocked" // dimmed, sweat drop — waiting on something
  | "sleep" // eyes closed, Zzz drifting up
  | "panic" // shaking, wide eyes, open mouth
  | "happy" // single bounce, smile
  | "wave"; // one arm waving

export type GopherState = "idle" | "active" | "ok" | "warn" | "bad" | "done";

/** Topic gear: every gopher is dressed for the chapter it teaches.
 *  Explicit `role` wins; otherwise it's inferred from the actor/lane label. */
export type GopherRole =
  | "worker" // hard hat — pools, consumers, batch workers
  | "detective" // magnifier — debugging, tracing, fraud, search
  | "guard" // padlock — auth, security, secrets, TLS
  | "banker" // coin — money, payments, transfers, balances
  | "scribe" // ledger book — ledgers, audit, compliance
  | "courier" // envelope — messaging, events, queues, webhooks
  | "librarian" // DB cylinder — SQL, storage, caches
  | "timekeeper" // clock — time, timers, cron, schedulers
  | "mechanic" // wrench — tooling, lint, build, CI
  | "scientist" // flask — testing, fuzzing, benchmarks
  | "medic" // shield — reliability, retries, circuit breakers
  | "operator" // antenna — networking, HTTP, gRPC, servers/clients
  | "leader" // crown — leader election, consensus, raft
  | "sweeper" // broom — the garbage collector
  | "scholar" // mortarboard — DSA, interviews, algorithms
  | "hacker" // terminal — CLIs, shells
  | "captain" // ship wheel — Docker, Kubernetes, deploys
  | "runner" // race flag — labs, CTF, goroutine racers
  | "analyst" // bar chart — analytics, metrics, observability
  | "consumer"; // drumstick — queue/topic consumers (they CONSUME)

/* keyword → role. First match wins; order = specificity. */
const ROLE_KEYWORDS: [RegExp, GopherRole][] = [
  [/ledger|audit|complian|book|journal|entry/i, "scribe"],
  [/money|pay|charge|transfer|balance|account|bank|fintech|settle|coin|card/i, "banker"],
  [/auth|secur|secret|lock|tls|token|jwt|password|vault|cred/i, "guard"],
  [/debug|trace|profil|pprof|fraud|detect|search|find|inspect|delve|dlv/i, "detective"],
  [/kafka|queue|topic|broker|publish|subscrib|event|message|webhook|notif|mail|outbox|stream|produc/i, "courier"],
  [/\bdb\b|sql|postgres|redis|database|storage|disk|cache|store|repo|table|index/i, "librarian"],
  [/time|clock|timer|cron|schedul|ticker|deadline|ttl/i, "timekeeper"],
  [/lint|vet|build|\bci\b|tool|generate|compile|release/i, "mechanic"],
  [/test|fuzz|bench|mock|verif|assert/i, "scientist"],
  [/retr(y|ies)|circuit|breaker|rate.?limit|health|backoff|resilien|reliab/i, "medic"],
  [/leader|raft|consensus|election|quorum|primary|coordinator/i, "leader"],
  [/\bgc\b|garbage|sweep|mark|collector/i, "sweeper"],
  [/algorithm|interview|dsa|sort|graph|heap|pointer/i, "scholar"],
  [/\bcli\b|terminal|shell|command|prompt/i, "hacker"],
  [/docker|kubernetes|k8s|container|deploy|pod|ship|infra/i, "captain"],
  [/consum/i, "consumer"],
  [/worker|pool|process|batch|job|task/i, "worker"],
  [/lab|flag|ctf|race|goroutine/i, "runner"],
  [/analytic|metric|dashboard|observ|telemetry|slo|monitor/i, "analyst"],
  [/net|http|grpc|server|client|request|api|dns|proxy|gateway|socket|conn/i, "operator"],
];

/** Best-effort role from a free-text label ("ledger svc" → scribe). */
export function inferRole(label?: string): GopherRole | undefined {
  if (!label) return undefined;
  for (const [re, role] of ROLE_KEYWORDS) if (re.test(label)) return role;
  return undefined;
}

/* Accessory layers, drawn in the gopher's 64×64 viewBox.
   Hats sit on the head (y 0–14); held items hang by the right arm (x 48–64). */
function RoleGear({ role }: { role: GopherRole }) {
  switch (role) {
    case "worker": // yellow hard hat
      return (
        <g className="gph-gear">
          <path d="M19 10 a13 11 0 0 1 26 0 z" fill="#e8c35a" stroke="var(--gph-line)" strokeWidth="1.6" />
          <rect x="15" y="9" width="34" height="3.6" rx="1.8" fill="#d4af37" stroke="var(--gph-line)" strokeWidth="1.2" />
        </g>
      );
    case "detective": // magnifier in right paw
      return (
        <g className="gph-gear">
          <circle cx="56" cy="38" r="6" fill="rgba(120,170,255,.18)" stroke="#9fc2ff" strokeWidth="2" />
          <line x1="59.5" y1="43.5" x2="63" y2="49" stroke="#9fc2ff" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case "guard": // padlock
      return (
        <g className="gph-gear">
          <path d="M52 36 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke="#c8cfdd" strokeWidth="2" />
          <rect x="50" y="36" width="12" height="10" rx="2.4" fill="#8e99ad" stroke="var(--gph-line)" strokeWidth="1.4" />
          <circle cx="56" cy="41" r="1.6" fill="var(--gph-line)" />
        </g>
      );
    case "banker": // gold coin
      return (
        <g className="gph-gear">
          <circle cx="56" cy="40" r="6.4" fill="#e8c35a" stroke="#b08a18" strokeWidth="1.8" />
          <text x="56" y="43.4" textAnchor="middle" fontSize="8.4" fontWeight="700" fill="#7a5c08">$</text>
        </g>
      );
    case "scribe": // open ledger book
      return (
        <g className="gph-gear">
          <path d="M48 38 q6 -3 8 0 q2 -3 8 0 v9 q-6 -3 -8 0 q-2 -3 -8 0 z" fill="#f4f6fb" stroke="var(--gph-line)" strokeWidth="1.4" />
          <line x1="56" y1="38" x2="56" y2="46" stroke="var(--gph-line)" strokeWidth="1" />
          <line x1="50.5" y1="40.5" x2="54" y2="40" stroke="#9aa3b5" strokeWidth=".9" />
          <line x1="58" y1="40" x2="61.5" y2="40.5" stroke="#9aa3b5" strokeWidth=".9" />
        </g>
      );
    case "courier": // envelope
      return (
        <g className="gph-gear">
          <rect x="49" y="35" width="14" height="10" rx="1.6" fill="#f4f6fb" stroke="var(--gph-line)" strokeWidth="1.4" />
          <path d="M49 36 l7 5 l7 -5" fill="none" stroke="var(--gph-line)" strokeWidth="1.2" />
        </g>
      );
    case "librarian": // DB cylinder
      return (
        <g className="gph-gear">
          <ellipse cx="56" cy="35.5" rx="6.4" ry="2.6" fill="#8e99ad" stroke="var(--gph-line)" strokeWidth="1.3" />
          <path d="M49.6 35.5 v9 a6.4 2.6 0 0 0 12.8 0 v-9" fill="#6f7a8e" stroke="var(--gph-line)" strokeWidth="1.3" />
          <ellipse cx="56" cy="40" rx="6.4" ry="2.6" fill="none" stroke="var(--gph-line)" strokeWidth=".9" opacity=".6" />
        </g>
      );
    case "timekeeper": // wall clock
      return (
        <g className="gph-gear">
          <circle cx="56" cy="39" r="6.2" fill="#f4f6fb" stroke="var(--gph-line)" strokeWidth="1.6" />
          <line x1="56" y1="39" x2="56" y2="34.8" stroke="var(--gph-line)" strokeWidth="1.5" strokeLinecap="round" className="gph-clock-min" />
          <line x1="56" y1="39" x2="59" y2="40.6" stroke="var(--gph-line)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case "mechanic": // wrench
      return (
        <g className="gph-gear">
          <path d="M51 47 l7.5 -7.5 a4.4 4.4 0 1 1 3 3 L54 50 a2.1 2.1 0 0 1 -3 -3 z" fill="#9aa3b5" stroke="var(--gph-line)" strokeWidth="1.3" />
        </g>
      );
    case "scientist": // bubbling flask
      return (
        <g className="gph-gear">
          <path d="M54 33 h4 v5 l4.5 8 a2 2 0 0 1 -1.8 3 h-9.4 a2 2 0 0 1 -1.8 -3 l4.5 -8 z" fill="rgba(110,231,170,.25)" stroke="#6ee7aa" strokeWidth="1.5" />
          <circle cx="55" cy="44" r="1" fill="#6ee7aa" className="gph-bubble" />
          <circle cx="58" cy="46" r=".8" fill="#6ee7aa" className="gph-bubble gph-bubble-2" />
        </g>
      );
    case "medic": // shield
      return (
        <g className="gph-gear">
          <path d="M56 32 l6 2.2 v5 q0 5.4 -6 8 q-6 -2.6 -6 -8 v-5 z" fill="rgba(110,160,255,.2)" stroke="#9fc2ff" strokeWidth="1.6" />
          <path d="M53.4 39.5 l2 2 l3.4 -3.8" fill="none" stroke="#9fc2ff" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "operator": // antenna + signal
      return (
        <g className="gph-gear">
          <line x1="32" y1="8" x2="32" y2="1.5" stroke="#c8cfdd" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="1.5" r="1.8" fill="#9fc2ff" />
          <path d="M36.5 4 a6.5 6.5 0 0 0 -9 0" fill="none" stroke="#9fc2ff" strokeWidth="1.3" className="gph-signal" />
          <path d="M39 1.6 a10 10 0 0 0 -14 0" fill="none" stroke="#9fc2ff" strokeWidth="1.1" opacity=".6" className="gph-signal gph-signal-2" />
        </g>
      );
    case "leader": // crown
      return (
        <g className="gph-gear">
          <path d="M21 9.5 l4 -6 l5 4.5 l2 -6 l2 6 l5 -4.5 l4 6 z" fill="#e8c35a" stroke="#b08a18" strokeWidth="1.3" />
        </g>
      );
    case "sweeper": // broom
      return (
        <g className="gph-gear">
          <line x1="51" y1="30" x2="60" y2="44" stroke="#b08868" strokeWidth="2" strokeLinecap="round" />
          <path d="M58 42 l8 0 l-3 9 l-7 -4 z" fill="#d4af37" stroke="var(--gph-line)" strokeWidth="1.2" />
        </g>
      );
    case "scholar": // mortarboard
      return (
        <g className="gph-gear">
          <path d="M32 2 l15 5 l-15 5 l-15 -5 z" fill="#3c4254" stroke="var(--gph-line)" strokeWidth="1.3" />
          <line x1="44" y1="8.6" x2="44" y2="14" stroke="#e8c35a" strokeWidth="1.4" />
          <circle cx="44" cy="15" r="1.4" fill="#e8c35a" />
        </g>
      );
    case "hacker": // tiny terminal card
      return (
        <g className="gph-gear">
          <rect x="48" y="34" width="15" height="11" rx="1.8" fill="#14161d" stroke="#3c4254" strokeWidth="1.3" />
          <text x="50" y="42" fontSize="6.5" fontFamily="monospace" fill="#6ee7aa">&gt;_</text>
        </g>
      );
    case "captain": // ship's wheel
      return (
        <g className="gph-gear">
          <circle cx="56" cy="40" r="5.6" fill="none" stroke="#c8cfdd" strokeWidth="1.7" />
          <circle cx="56" cy="40" r="1.7" fill="#c8cfdd" />
          {[0, 45, 90, 135].map((a) => (
            <line
              key={a}
              x1={56 - 7.4 * Math.cos((a * Math.PI) / 180)}
              y1={40 - 7.4 * Math.sin((a * Math.PI) / 180)}
              x2={56 + 7.4 * Math.cos((a * Math.PI) / 180)}
              y2={40 + 7.4 * Math.sin((a * Math.PI) / 180)}
              stroke="#c8cfdd"
              strokeWidth="1.5"
            />
          ))}
        </g>
      );
    case "runner": // checkered race flag
      return (
        <g className="gph-gear">
          <line x1="51" y1="30" x2="51" y2="48" stroke="#c8cfdd" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M51 30 h12 v8 h-12 z" fill="#f4f6fb" stroke="var(--gph-line)" strokeWidth="1.2" />
          <rect x="51" y="30" width="4" height="4" fill="#14161d" />
          <rect x="59" y="30" width="4" height="4" fill="#14161d" />
          <rect x="55" y="34" width="4" height="4" fill="#14161d" />
        </g>
      );
    case "analyst": // rising bar chart card
      return (
        <g className="gph-gear">
          <rect x="48" y="33" width="15" height="12" rx="1.8" fill="#1c2030" stroke="#3c4254" strokeWidth="1.3" />
          <rect x="50.5" y="40" width="2.6" height="3.4" fill="#6ee7aa" />
          <rect x="54.5" y="38" width="2.6" height="5.4" fill="#9fc2ff" />
          <rect x="58.5" y="35.5" width="2.6" height="7.9" fill="var(--accent, #e8c35a)" />
        </g>
      );
    case "consumer": // drumstick raised to the mouth — it consumes
      return (
        <g className="gph-gear gph-chomp">
          {/* meat */}
          <ellipse cx="50" cy="38" rx="6" ry="4.6" transform="rotate(-35 50 38)" fill="#c98a4b" stroke="#8a5a28" strokeWidth="1.4" />
          {/* bone */}
          <line x1="54.5" y1="42" x2="60" y2="47" stroke="#f4f6fb" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="60.5" cy="46" r="2" fill="#f4f6fb" stroke="#c8cfdd" strokeWidth=".8" />
          <circle cx="58.5" cy="48.5" r="2" fill="#f4f6fb" stroke="#c8cfdd" strokeWidth=".8" />
          {/* bite taken */}
          <circle cx="47" cy="35.5" r="2.2" fill="var(--gph-tint)" />
        </g>
      );
  }
}

/** Geometric gopher. Pure SVG + CSS classes; no hooks, renders anywhere.
 *  Dress it for the topic with `role` (or let callers infer one from a label). */
export function Gopher({
  pose = "idle",
  state = "idle",
  size = 44,
  payload,
  flip = false,
  title,
  role,
}: {
  pose?: GopherPose;
  state?: GopherState;
  size?: number;
  /** short label drawn in the box the gopher carries (pose="carry") */
  payload?: string;
  flip?: boolean;
  title?: string;
  /** topic gear — see GopherRole; use inferRole(label) when you only have text */
  role?: GopherRole;
}) {
  const eyesClosed = pose === "sleep";
  const panicked = pose === "panic";
  return (
    <span
      className={`gph gph-pose-${pose} gph-st-${state} ${flip ? "gph-flip" : ""}`}
      style={{ "--gph-size": `${size}px` } as CSSProperties}
      role="img"
      aria-label={title ?? `gopher (${role ?? pose})`}
    >
      {pose === "carry" && (
        <span className="gph-payload">{payload ?? "▣"}</span>
      )}
      {pose === "sleep" && (
        <span className="gph-zzz" aria-hidden>
          <i>z</i>
          <i>z</i>
          <i>z</i>
        </span>
      )}
      {pose === "blocked" && <span className="gph-sweat" aria-hidden />}
      <svg
        className="gph-svg"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        aria-hidden
      >
        {/* ears */}
        <circle className="gph-ear" cx="19" cy="11" r="5.5" />
        <circle className="gph-ear" cx="45" cy="11" r="5.5" />
        <circle className="gph-ear-in" cx="19" cy="11" r="2.4" />
        <circle className="gph-ear-in" cx="45" cy="11" r="2.4" />
        {/* body: one rounded capsule (head+body merged = the geometric look) */}
        <rect className="gph-body" x="13" y="8" width="38" height="48" rx="17" />
        {/* arms (rotated by pose via CSS transform-origin) */}
        <rect className="gph-arm gph-arm-l" x="9" y="30" width="7" height="14" rx="3.5" />
        <rect className="gph-arm gph-arm-r" x="48" y="30" width="7" height="14" rx="3.5" />
        {/* feet */}
        <ellipse className="gph-foot gph-foot-l" cx="24" cy="57" rx="7" ry="4.4" />
        <ellipse className="gph-foot gph-foot-r" cx="40" cy="57" rx="7" ry="4.4" />
        {/* eyes */}
        {eyesClosed ? (
          <>
            <path className="gph-eye-shut" d="M18 26 q5 3.4 10 0" />
            <path className="gph-eye-shut" d="M36 26 q5 3.4 10 0" />
          </>
        ) : (
          <>
            <circle className="gph-eye" cx="23.5" cy="25" r="6.6" />
            <circle className="gph-eye" cx="40.5" cy="25" r="6.6" />
            <circle className="gph-pupil" cx="25" cy="26" r={panicked ? 3.4 : 2.3} />
            <circle className="gph-pupil" cx="42" cy="26" r={panicked ? 3.4 : 2.3} />
          </>
        )}
        {/* nose + teeth */}
        <ellipse className="gph-nose" cx="32" cy="32.5" rx="3.4" ry="2.6" />
        {panicked ? (
          <ellipse className="gph-mouth" cx="32" cy="40" rx="4.2" ry="5" />
        ) : pose === "happy" ? (
          <path className="gph-smile" d="M26 38 q6 5 12 0" />
        ) : (
          <>
            <rect className="gph-teeth" x="29" y="35.5" width="6" height="5.6" rx="1.6" />
            <line className="gph-teeth-gap" x1="32" y1="36" x2="32" y2="40.6" />
          </>
        )}
        {/* topic gear LAST so hats/tools sit on top of the body.
            Keyed by role: when a gopher MORPHS (role changes mid-scene,
            e.g. follower → leader on election), the new gear plays its
            materialize animation — the transformation is the teaching beat. */}
        {role && (
          <g key={role} className="gph-morph">
            <RoleGear role={role} />
          </g>
        )}
      </svg>
    </span>
  );
}
