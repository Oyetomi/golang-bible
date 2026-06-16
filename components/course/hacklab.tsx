"use client";

import { useMemo, useState, type ReactNode } from "react";

/* ════════════════════════════════════════════
   HackLab — an interactive, browser-only attack
   lab in the CTBB style (Goal / Lab / Exploit /
   Report tabs). The vulnerable "backend" is
   simulated in-page over mock data, so it runs
   in the static export with no server. Each
   `mode` is a self-contained attack engine.

   For authorized learning only — every target
   here is a fictional in-page mock.
   ════════════════════════════════════════════ */

type Tab = "goal" | "lab" | "exploit" | "report";

type HackLabProps = {
  title: string;
  category?: string; // "Server-Side" | "Client-Side"
  mode: "idor" | "xss" | "sqli" | "jwt";
  flag?: string;
};

export function HackLab({ title, category = "Server-Side", mode, flag }: HackLabProps) {
  const [tab, setTab] = useState<Tab>("goal");
  const [solved, setSolved] = useState(false);
  const scenario = SCENARIOS[mode];

  return (
    <div className="hacklab">
      <div className="hl-head">
        <span className="hl-cat">{category}</span>
        <span className="hl-title">{title}</span>
        {solved && <span className="hl-solved">✓ solved</span>}
      </div>

      <div className="hl-tabs" role="tablist">
        {(["goal", "lab", "exploit", "report"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`hl-tab ${tab === t ? "on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="hl-panel">
        {tab === "goal" && scenario.goal}
        {tab === "lab" && scenario.lab(solved, setSolved)}
        {tab === "exploit" && scenario.exploit}
        {tab === "report" && scenario.report(solved, flag)}
      </div>
    </div>
  );
}

/* ── shared little building blocks ─────────── */
function Goal({ what, example, mission }: { what: ReactNode; example?: ReactNode; mission: ReactNode[] }) {
  return (
    <div className="hl-goal">
      <h4>The vulnerability</h4>
      <p>{what}</p>
      {example && (
        <div className="hl-example">
          <strong>Example</strong>
          <p>{example}</p>
        </div>
      )}
      <h4>Your mission</h4>
      <ol>
        {mission.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ol>
    </div>
  );
}

function Exploit({ summary, steps, bonus }: { summary: ReactNode; steps: ReactNode[]; bonus?: ReactNode }) {
  return (
    <div className="hl-exploit">
      <h4>Solution</h4>
      <p>{summary}</p>
      <h5>Exploitation steps</h5>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {bonus && (
        <div className="hl-bonus">
          <strong>Bonus</strong>
          <p>{bonus}</p>
        </div>
      )}
    </div>
  );
}

function Report({
  summary,
  steps,
  impact,
  solved,
  flag,
}: {
  summary: ReactNode;
  steps: ReactNode[];
  impact: ReactNode;
  solved: boolean;
  flag?: string;
}) {
  return (
    <div className="hl-report">
      <h4>Bug bounty report</h4>
      <h5>Summary</h5>
      <p>{summary}</p>
      <h5>Reproduction steps</h5>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <h5>Impact</h5>
      <p>{impact}</p>
      {flag && (
        <div className={`hl-flag ${solved ? "got" : ""}`}>
          {solved ? <>🚩 Flag captured: <code>{flag}</code></> : "Solve the Lab tab to capture the flag."}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   IDOR engine — SecureCorp portal. You're logged
   in as one user; the profile API takes an `id`
   and never checks ownership. Change it to read
   anyone — and the raw response leaks a field the
   UI hides.
   ════════════════════════════════════════════ */
type MockUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  joined: string;
  passwordHash: string; // leaked in raw response, hidden in UI
};

const IDOR_USERS: MockUser[] = [
  { id: 1, name: "Alice Martin", email: "alice.martin@testmail.org", phone: "555-2090", role: "admin", joined: "2025-01-04", passwordHash: "$2b$10$9aQ…f3" },
  { id: 2, name: "Ben Carter", email: "ben.carter@testmail.org", phone: "555-7741", role: "user", joined: "2025-03-22", passwordHash: "$2b$10$1xK…7d" },
  { id: 3, name: "Chloe Adams", email: "chloe.adams@testmail.org", phone: "555-3310", role: "user", joined: "2025-06-01", passwordHash: "$2b$10$8mP…2c" },
  { id: 4, name: "Diana Johnson", email: "diana.johnson@testmail.org", phone: "555-1841", role: "user", joined: "2025-09-19", passwordHash: "$2b$10$4eR…9a" },
];

function IdorLab({ solved, onSolve }: { solved: boolean; onSolve: (v: boolean) => void }) {
  const setSolved = onSolve;
  const me = 4; // logged-in user
  const [idInput, setIdInput] = useState(String(me));
  const [fetched, setFetched] = useState<MockUser | null>(IDOR_USERS.find((u) => u.id === me) ?? null);
  const [showRaw, setShowRaw] = useState(false);
  const [foundRaw, setFoundRaw] = useState(false);

  const send = () => {
    const id = parseInt(idInput, 10);
    // THE VULNERABILITY: the mock API returns any user by id, with no
    // ownership check against the logged-in user (me).
    const u = IDOR_USERS.find((x) => x.id === id) ?? null;
    setFetched(u);
    if (u && u.id !== me) setSolved(true); // accessed someone else → solved
  };

  return (
    <div className="hl-idor">
      <p className="hl-note">
        You are logged into <strong>SecureCorp Portal</strong> as <strong>Diana Johnson (id {me})</strong>.
        The profile page loads from <code>GET /api/viewUser?id={idInput || "…"}</code>. Try another id.
      </p>

      <div className="hl-reqbar">
        <span className="hl-method">GET</span>
        <code className="hl-url">/api/viewUser?id=</code>
        <input
          className="hl-input"
          value={idInput}
          inputMode="numeric"
          aria-label="user id parameter"
          onChange={(e) => setIdInput(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <button className="hl-send" onClick={send}>Send</button>
      </div>

      {fetched ? (
        <div className="hl-profile">
          <div className="hl-pf-head">
            <span className="hl-avatar">{fetched.name.split(" ").map((w) => w[0]).join("")}</span>
            <div>
              <div className="hl-pf-name">{fetched.name}</div>
              <div className="hl-pf-sub">{fetched.id === me ? "Your Profile" : `Profile #${fetched.id} — not yours`}</div>
            </div>
          </div>
          <div className="hl-pf-grid">
            <Field label="User ID" v={String(fetched.id)} />
            <Field label="Email" v={fetched.email} />
            <Field label="Phone" v={fetched.phone} />
            <Field label="Role" v={fetched.role} />
            <Field label="Joined" v={fetched.joined} />
            <Field label="Password" v="••••••••" />
          </div>

          <button className="hl-rawtoggle" onClick={() => { setShowRaw((s) => !s); setFoundRaw(true); }}>
            {showRaw ? "Hide" : "Show"} raw API response (the Network tab)
          </button>
          {showRaw && (
            <pre className="hl-raw">
{JSON.stringify(
  { id: fetched.id, name: fetched.name, email: fetched.email, phone: fetched.phone, role: fetched.role, joined: fetched.joined, passwordHash: fetched.passwordHash },
  null,
  2
)}
            </pre>
          )}
        </div>
      ) : (
        <p className="hl-miss">No user with that id.</p>
      )}

      <div className="hl-status">
        {solved ? (
          <span className="hl-ok">
            ✓ IDOR confirmed — you read another user's profile by changing the id.{" "}
            {foundRaw && "And the raw response leaked passwordHash, a field the UI never shows."}
          </span>
        ) : (
          <span className="hl-todo">Change the id to a value that isn't 4, then Send.</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, v }: { label: string; v: string }) {
  return (
    <div className="hl-field">
      <div className="hl-field-l">{label}</div>
      <div className="hl-field-v">{v}</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   XSS engine — a comment box rendered two ways
   side by side: a vulnerable app (raw HTML) and
   a hardened one (html/template, contextually
   escaped). Execution is SIMULATED — we detect an
   XSS payload and show a "fired" badge; no script
   actually runs.
   ════════════════════════════════════════════ */
const XSS_RE = /<script|onerror\s*=|onload\s*=|onmouseover\s*=|<img[^>]+src|<svg|javascript:/i;

function XssLab({ solved, onSolve }: { solved: boolean; onSolve: (v: boolean) => void }) {
  const [payload, setPayload] = useState('<img src=x onerror=alert(document.domain)>');
  const fires = XSS_RE.test(payload);
  const escaped = payload.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const run = () => { if (fires) onSolve(true); };

  return (
    <div className="hl-xss">
      <p className="hl-note">
        A merchant's "business name" is shown on an admin dashboard. Type a value and post it — the
        <strong> vulnerable app</strong> drops it into the HTML raw; the <strong>hardened app</strong> renders it through Go's
        <code>html/template</code>. Execution here is simulated (no real script runs).
      </p>
      <textarea
        className="hl-textarea"
        rows={2}
        value={payload}
        aria-label="comment payload"
        onChange={(e) => setPayload(e.target.value)}
      />
      <button className="hl-send" onClick={run}>Post comment</button>

      <div className="hl-xss-panes">
        <div className="hl-pane hl-pane-bad">
          <div className="hl-pane-h">Vulnerable app — <code>text/template</code> / raw</div>
          <div className="hl-pane-body">
            Business name: {fires ? (
              <span className="hl-fired">💥 alert(document.domain) — XSS executed</span>
            ) : (
              <span className="hl-rendered">{payload}</span>
            )}
          </div>
        </div>
        <div className="hl-pane hl-pane-good">
          <div className="hl-pane-h">Hardened app — <code>html/template</code></div>
          <div className="hl-pane-body">
            Business name: <span className="hl-escaped">{escaped}</span>
            <div className="hl-pane-note">escaped to text — the browser shows it, never runs it.</div>
          </div>
        </div>
      </div>

      <div className="hl-status">
        {solved ? (
          <span className="hl-ok">✓ XSS fired in the vulnerable app. Note the hardened app rendered the identical payload as inert text — same input, opposite outcome, decided entirely by which template package escaped it.</span>
        ) : (
          <span className="hl-todo">Post a payload that executes in the vulnerable pane (try an <code>&lt;img onerror&gt;</code> or <code>&lt;script&gt;</code>).</span>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   SQLi engine — a login form. The vulnerable
   build concatenates input into the query, so a
   tautology logs you in as admin with no password.
   The parameterized build treats the same input
   as a literal value and rejects it.
   ════════════════════════════════════════════ */
const SQLI_BYPASS = /'\s*or\s*'?1'?\s*=\s*'?1|'\s*or\s*1\s*=\s*1|'\s*--|'\s*#|'\s*or\s*'/i;

function SqliLab({ solved, onSolve }: { solved: boolean; onSolve: (v: boolean) => void }) {
  const [user, setUser] = useState("admin' --");
  const [pass, setPass] = useState("anything");
  const [mode, setMode] = useState<"vuln" | "safe">("vuln");
  const [result, setResult] = useState<null | { ok: boolean; as?: string; why: string }>(null);

  const vulnQuery = `SELECT * FROM users WHERE username = '${user}' AND password = '${pass}'`;

  const login = () => {
    if (mode === "safe") {
      // parameterized: the value can never be SQL; only a real match logs in
      const ok = user === "admin" && pass === "s3cr3t";
      setResult({ ok, as: ok ? "admin" : undefined, why: ok ? "valid credentials" : "the injection is treated as a literal username — no such user." });
      return;
    }
    // vulnerable: string-built query. A tautology / comment makes the WHERE true.
    const bypass = SQLI_BYPASS.test(user) || SQLI_BYPASS.test(pass);
    const realMatch = user === "admin" && pass === "s3cr3t";
    const ok = bypass || realMatch;
    if (ok) onSolve(true);
    setResult({ ok, as: ok ? "admin" : undefined, why: bypass ? "the injected ' -- / OR 1=1 turned the WHERE clause into a tautology — auth bypassed." : realMatch ? "valid credentials" : "no match." });
  };

  return (
    <div className="hl-sqli">
      <p className="hl-note">
        A login handler. The query is built two ways — switch the mode and watch the same injection
        succeed against the string-built query and fail against the parameterized one.
      </p>
      <div className="hl-modeswitch">
        <button className={mode === "vuln" ? "on" : ""} onClick={() => { setMode("vuln"); setResult(null); }}>Vulnerable (string-built)</button>
        <button className={mode === "safe" ? "on" : ""} onClick={() => { setMode("safe"); setResult(null); }}>Parameterized ($1)</button>
      </div>
      <label className="hl-flabel">Username
        <input className="hl-input hl-wide" value={user} onChange={(e) => setUser(e.target.value)} aria-label="username" />
      </label>
      <label className="hl-flabel">Password
        <input className="hl-input hl-wide" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="password" />
      </label>

      <div className="hl-query">
        <span className="hl-query-h">Query the server runs:</span>
        {mode === "vuln"
          ? <code>{vulnQuery}</code>
          : <code>SELECT * FROM users WHERE username = $1 AND password = $2{"   "}-- args: [{JSON.stringify(user)}, {JSON.stringify(pass)}]</code>}
      </div>
      <button className="hl-send" onClick={login}>Log in</button>

      {result && (
        <div className={`hl-result ${result.ok ? "bad" : "good"}`}>
          {result.ok ? `✓ Logged in as ${result.as}` : "✗ Login failed"} — {result.why}
        </div>
      )}

      <div className="hl-status">
        {solved ? (
          <span className="hl-ok">✓ You bypassed auth via SQL injection on the string-built query. Switch to Parameterized and try the exact same input — it fails, because the value travels as data and can never be parsed as SQL.</span>
        ) : (
          <span className="hl-todo">In Vulnerable mode, log in without valid credentials using an injection like <code>admin' --</code>.</span>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   JWT engine — a token decoded into editable
   fields. The vulnerable verifier trusts the
   header's alg (so alg:none skips signature
   checking); the pinned verifier requires RS256
   with the original signature. Forge an admin
   token the vulnerable verifier accepts.
   ════════════════════════════════════════════ */
function JwtLab({ solved, onSolve }: { solved: boolean; onSolve: (v: boolean) => void }) {
  const [alg, setAlg] = useState("RS256");
  const [role, setRole] = useState("user");
  const [out, setOut] = useState<null | { vuln: string; pinned: string }>(null);

  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  const sigTampered = role !== "user"; // changing a claim invalidates the original signature
  const token = `${b64({ alg, typ: "JWT" })}.${b64({ sub: "1337", role })}.${alg === "none" ? "" : "SflKxwRJ…origSig"}`;

  const verify = () => {
    // VULNERABLE: dispatches on the token's own alg.
    let vuln: string;
    if (alg === "none") vuln = `accepted (alg:none → signature skipped) → role=${role}`;
    else if (!sigTampered) vuln = `accepted (RS256, signature matches) → role=${role}`;
    else vuln = "rejected (RS256 signature no longer matches the tampered claims)";
    // PINNED: requires RS256 AND an intact signature.
    const pinned = alg === "RS256" && !sigTampered ? `accepted → role=${role}` : `rejected (algorithm/signature not the pinned RS256 with a valid signature)`;
    setOut({ vuln, pinned });
    if (alg === "none" && role === "admin") onSolve(true);
  };

  return (
    <div className="hl-jwt">
      <p className="hl-note">
        A signed JWT carries <code>role=user</code>. Edit the header's <code>alg</code> and the <code>role</code> claim, then submit it
        to two verifiers. Forge an <strong>admin</strong> token the vulnerable verifier accepts.
      </p>
      <div className="hl-jwt-fields">
        <label className="hl-flabel">Header alg
          <select className="hl-input hl-wide" value={alg} onChange={(e) => setAlg(e.target.value)} aria-label="alg">
            <option>RS256</option>
            <option>none</option>
          </select>
        </label>
        <label className="hl-flabel">Claim role
          <select className="hl-input hl-wide" value={role} onChange={(e) => setRole(e.target.value)} aria-label="role">
            <option>user</option>
            <option>admin</option>
          </select>
        </label>
      </div>
      <div className="hl-query"><span className="hl-query-h">Forged token:</span><code className="hl-token">{token}</code></div>
      <button className="hl-send" onClick={verify}>Submit to verifiers</button>

      {out && (
        <div className="hl-verifiers">
          <div className={`hl-result ${out.vuln.startsWith("accepted") ? "bad" : "good"}`}>Vulnerable verifier: {out.vuln}</div>
          <div className={`hl-result ${out.pinned.startsWith("accepted") ? "bad" : "good"}`}>Pinned verifier: {out.pinned}</div>
        </div>
      )}

      <div className="hl-status">
        {solved ? (
          <span className="hl-ok">✓ Forged an admin token via alg:none — the vulnerable verifier trusted the header and skipped the signature. The pinned verifier (RS256 + intact signature required) rejected it. The fix is to never let the token choose the algorithm.</span>
        ) : (
          <span className="hl-todo">Set <code>alg = none</code> and <code>role = admin</code>, then submit.</span>
        )}
      </div>
    </div>
  );
}

/* ── scenario registry ─────────────────────── */
type Scenario = {
  goal: ReactNode;
  lab: (solved: boolean, setSolved: (v: boolean) => void) => ReactNode;
  exploit: ReactNode;
  report: (solved: boolean, flag?: string) => ReactNode;
};

const SCENARIOS: Record<HackLabProps["mode"], Scenario> = {
  idor: {
    goal: (
      <Goal
        what="Insecure Direct Object Reference (IDOR) happens when an app exposes an internal object reference (like a database id) and serves the object without checking that the requester is allowed to see it. Knowing the id becomes the same as being authorized — which it must never be."
        example={<>You are user id <code>4</code>. Change the id in the request to <code>1</code> and you read another user's profile, including data that isn't yours.</>}
        mission={[
          "In the Lab tab, note your own user id in the request.",
          "Change the id parameter to a different value and Send.",
          "Read a user's profile that isn't yours — that's the IDOR.",
          <><strong>Bonus:</strong> open the raw API response (the Network tab) and find a sensitive field the UI doesn't display.</>,
        ]}
      />
    ),
    lab: (solved, setSolved) => <IdorLab key="idor" solved={solved} onSolve={setSolved} />,
    exploit: (
      <Exploit
        summary={<>The endpoint <code>/api/viewUser?id=X</code> does not verify that the requesting user is authorized to view the requested profile. It returns whatever id you ask for.</>}
        steps={[
          <>Log in and note your assigned id in the URL (here, <code>id=4</code>).</>,
          <>Change <code>id</code> to a nearby value (<code>id=1</code>, <code>id=2</code>, …).</>,
          "Observe that you can read any other user's personal information.",
        ]}
        bonus={<>Open DevTools → Network and inspect the raw response: the server sends <code>passwordHash</code> too — the frontend simply chooses not to render it. APIs leak fields the UI hides.</>}
      />
    ),
    report: (solved, flag) => (
      <Report
        solved={solved}
        flag={flag}
        summary={<>An IDOR vulnerability exists in <code>/api/viewUser</code>. The endpoint accepts a user <code>id</code> without verifying the requester is authorized to view that profile, letting any authenticated user read any other user's personal information.</>}
        steps={[
          'Log in (you are assigned a user id, e.g. id=4).',
          <>Change the <code>id</code> parameter to another value (e.g. <code>id=1</code>).</>,
          "Observe the other user's profile is returned.",
        ]}
        impact={<>An attacker enumerates ids to harvest every user's PII (name, email, phone) — and the raw API response also exposes <code>passwordHash</code>. Sequential ids make bulk extraction trivial. Fix: enforce ownership in the handler (<code>WHERE id = $id AND owner = $caller</code>), and return 404 for unauthorized ids.</>}
      />
    ),
  },
  xss: {
    goal: (
      <Goal
        what="Reflected/stored Cross-Site Scripting (XSS) happens when user input is written into a page's HTML without being escaped for its context, so the browser runs it as code. The fix in Go is html/template, which escapes each value for exactly where it lands."
        example={<>A merchant sets their business name to <code>&lt;img src=x onerror=alert(1)&gt;</code>. A vulnerable app drops it into the dashboard HTML raw — and every admin who views it runs the script.</>}
        mission={[
          "In the Lab tab, type a payload into the comment box.",
          "Post it and make it execute in the vulnerable pane.",
          <>Compare the hardened pane: the same payload, rendered by <code>html/template</code>, is inert text.</>,
        ]}
      />
    ),
    lab: (solved, setSolved) => <XssLab key="xss" solved={solved} onSolve={setSolved} />,
    exploit: (
      <Exploit
        summary="The vulnerable app concatenates the business name straight into HTML (the equivalent of Go's text/template, which never escapes). Any HTML you supply becomes part of the page."
        steps={[
          <>Find a reflected input (here, the business name).</>,
          <>Inject a tag that runs JS on load: <code>&lt;img src=x onerror=alert(document.domain)&gt;</code>.</>,
          "When an admin views the page, your script runs in their session.",
        ]}
        bonus={<>The hardened pane uses <code>html/template</code>, which knows the value is in an HTML body and entity-encodes it. The exact same payload is shown as text — never executed. Different context (attribute, &lt;script&gt;, URL) → different escaping, automatically.</>}
      />
    ),
    report: (solved, flag) => (
      <Report
        solved={solved}
        flag={flag}
        summary="A stored XSS exists in the merchant business-name field, rendered unescaped on the admin dashboard. An attacker-controlled merchant can run arbitrary JavaScript in any admin's browser."
        steps={["Register/edit a merchant.", "Set the business name to an XSS payload (e.g. <img src=x onerror=alert(document.domain)>).", "Have an admin view the dashboard — the script executes."]}
        impact={<>Script execution in an admin session = session-cookie theft, actions as the admin, full dashboard takeover. Fix: render all user data through <code>html/template</code> (never <code>text/template</code> for HTML), and never wrap external input in <code>template.HTML</code>.</>}
      />
    ),
  },
  sqli: {
    goal: (
      <Goal
        what="SQL injection happens when user input is concatenated into a query string instead of passed as a parameter, letting the attacker end the data and write SQL. The fix is a parameterized query, where the value can never be parsed as SQL."
        example={<>A login query <code>… WHERE username = '$user'</code> with <code>$user = admin' --</code> becomes <code>… WHERE username = 'admin' --'</code>, commenting out the password check.</>}
        mission={[
          "In the Lab tab (Vulnerable mode), log in without valid credentials.",
          <>Use an injection like <code>admin' --</code> or <code>' OR '1'='1</code>.</>,
          "Switch to Parameterized mode and try the same input — watch it fail.",
        ]}
      />
    ),
    lab: (solved, setSolved) => <SqliLab key="sqli" solved={solved} onSolve={setSolved} />,
    exploit: (
      <Exploit
        summary="The vulnerable handler builds the query by string concatenation, so your input becomes SQL. A comment (--) or a tautology (OR 1=1) makes the WHERE clause always true."
        steps={[
          <>Enter <code>admin' --</code> as the username (any password).</>,
          <>The query becomes <code>… WHERE username = 'admin' --' AND password = '…'</code> — the password check is commented out.</>,
          "You're logged in as admin with no password.",
        ]}
        bonus={<>Switch to Parameterized: the input is sent as an argument (<code>$1</code>), so the database treats <code>admin' --</code> as a literal username. No such user exists → login fails. The value never reaches the SQL parser.</>}
      />
    ),
    report: (solved, flag) => (
      <Report
        solved={solved}
        flag={flag}
        summary="The login endpoint builds its SQL by string concatenation, allowing authentication bypass and arbitrary query manipulation via SQL injection."
        steps={["Go to the login form.", "Enter admin' -- as the username and any password.", "Observe authentication is bypassed (logged in as admin)."]}
        impact={<>Full authentication bypass, and (with UNION/blind techniques) read/modify any table — total database compromise. Fix: parameterized queries everywhere (<code>db.Query("… WHERE username = $1", user)</code>); never build SQL with <code>fmt.Sprintf</code>.</>}
      />
    ),
  },
  jwt: {
    goal: (
      <Goal
        what="A JWT's header tells the verifier how to check it. If the verifier trusts that header — its alg field — an attacker sets alg to 'none', which means 'no signature', and forges any claims they like. The fix: the server pins the algorithm; the token never chooses."
        example={<>Change the header to <code>{`{"alg":"none"}`}</code>, set <code>role: admin</code>, drop the signature. A naive verifier accepts it.</>}
        mission={[
          "In the Lab tab, edit the token's alg and role.",
          <>Set <code>alg = none</code> and <code>role = admin</code>.</>,
          "Submit it and get the vulnerable verifier to accept your forged admin token.",
        ]}
      />
    ),
    lab: (solved, setSolved) => <JwtLab key="jwt" solved={solved} onSolve={setSolved} />,
    exploit: (
      <Exploit
        summary="The vulnerable verifier reads alg from the token and dispatches on it. With alg:none it performs no signature check at all, so any claims you write are accepted."
        steps={[
          <>Decode the token; change the header to <code>{`{"alg":"none"}`}</code>.</>,
          <>Change the payload claim to <code>role: admin</code>.</>,
          "Remove the signature (leave the trailing dot) and send it — accepted as admin.",
        ]}
        bonus={<>The pinned verifier requires RS256 and an intact signature, so alg:none and any tampered claim are both rejected. Same idea defeats algorithm confusion (RS256→HS256) and kid/jwk injection: the algorithm and key are server policy, never token data.</>}
      />
    ),
    report: (solved, flag) => (
      <Report
        solved={solved}
        flag={flag}
        summary="The token verifier honors the alg header from the JWT itself, allowing the alg:none algorithm-bypass attack: an attacker forges a token with arbitrary claims and no valid signature."
        steps={["Capture a valid JWT.", 'Set the header to {"alg":"none"} and the payload to role=admin.', "Strip the signature and replay — the server accepts it as an admin."]}
        impact={<>Full authentication/authorization bypass — forge any identity or privilege. Fix: in golang-jwt's key function, assert <code>token.Method</code> equals your single expected algorithm and reject everything else; never read <code>kid</code>/<code>jwk</code>/<code>jku</code> as key sources.</>}
      />
    ),
  },
};
