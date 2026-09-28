"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AclServer, FLAGS, USERS, type LabId, type Res } from "@/lib/range/acl";
import { recordLab } from "@/lib/gamification";
import { playFlag } from "@/lib/sound";
import { triggerConfetti } from "@/lib/confetti";

/* ════════════════════════════════════════════
   RangeLab — a practice target you can attack
   without a terminal. A Repeater-style console
   (method, path, who you are logged in as, body)
   talks to an in-page copy of the chapter's
   accounts service; nothing leaves the tab and
   every account is fictional. "Deploy the fix"
   swaps the leaky route for the fixed one so you
   can see the same request stop working.
   ════════════════════════════════════════════ */

type LabDef = {
  title: string;
  goal: string;
  hints: string[];
  starter: { method: string; path: string; user: string; body: string };
  fixKey: string;
  fixNote: string;
  fixCode: string;
  admin?: boolean;
};

const LABS: Record<LabId, LabDef> = {
  bola: {
    title: "One login, every account",
    goal: "You are logged in as acme-u3, who owns 250 of the 3,000 accounts. Account 3999 belongs to somebody else and its memo holds a flag. Read it, and submit the flag.",
    hints: [
      "Send GET /v0/accounts/1001, then look at owner_id. Which account ids are yours?",
      "The ids are sequential. Ask for 3999.",
      "Now try the same id on /v1/accounts/3999 and compare the answers.",
    ],
    starter: { method: "GET", path: "/v0/accounts/1001", user: "acme-u3", body: "" },
    fixKey: "account",
    fixNote: "The lookup now names the caller: WHERE id = $1 AND tenant_id = $2 AND owner_id = $3. Send your request again.",
    fixCode: "WHERE id = $1 AND tenant_id = $2 AND owner_id = $3",
  },
  list: {
    title: "The list that lists everything",
    goal: "One account in the system has a memo that isn't yours, and you never have to guess its id. Find the memo in a list response and submit the flag.",
    hints: ["GET /v0/accounts returns a list.", "The response is long. Search it for \"memo\".", "Then compare with GET /v1/accounts."],
    starter: { method: "GET", path: "/v0/accounts", user: "acme-u3", body: "" },
    fixKey: "list",
    fixNote: "The list query now includes the caller (WHERE tenant_id = $1 AND owner_id = $2), so it returns only your 250 accounts.",
    fixCode: "WHERE tenant_id = $1 AND owner_id = $2",
  },
  tenant: {
    title: "Whose tenant is it?",
    goal: "As acme-u3 (a customer of Acme), make Globex account 1005 hold exactly 1,337 more cents than it started with. Then press Check my work.",
    hints: ["POST /v0/credits takes {\"tenant_id\", \"account_id\", \"amount\"}.", "Whose tenant_id does the service believe?", "Try the same body on /v1/credits."],
    starter: { method: "POST", path: "/v0/credits", user: "acme-u3", body: '{"tenant_id":"acme","account_id":1001,"amount":1}' },
    fixKey: "tenant",
    fixNote: "The tenant now comes from the verified login, and the body's tenant_id is ignored. Send your request again.",
    fixCode: "s.Credit(ctx, Who(r).TenantID, c.AccountID, c.Amount)  // not c.TenantID",
  },
  window: {
    title: "The permission change in flight",
    goal: "The admin has locked the email field: other users may not edit it. As acme-u3, change acme-u4's email anyway, without the admin ever leaving the field open for you. Use the Admin panel tab to act as the admin (open the field, then lock it), and watch the rule cache. Then press Check my work.",
    hints: [
      "PUT /v0/profiles/acme-u4 with {\"email\":\"x@example.com\"} is refused (403).",
      "The v0 route decides from a cached copy of the rules. How long does the cache live?",
      "The cache remembers the rules as they were when it was filled. The Admin panel shows what it holds and how old it is. If it still holds the field as locked, wait for it to expire.",
      "Once it has expired: open the field, send one edit (any field) so the cache refills while email is open, lock the field again, and edit the email before the cache expires.",
    ],
    starter: { method: "PUT", path: "/v0/profiles/acme-u4", user: "acme-u3", body: '{"email":"me@example.com"}' },
    fixKey: "window",
    fixNote: "The v0 route now checks the live rule inside the write itself (one statement), so a locked field is refused the instant the admin locks it.",
    fixCode: "UPDATE profiles SET email = $2 WHERE user_id = $1\n  AND (SELECT count(*) FROM field_rules WHERE field = ANY($3) AND editable) = $4",
    admin: true,
  },
};

function prettyBody(res: Res): { text: string; count?: number; bytes: number } {
  const bytes = new Blob([res.body]).size;
  try {
    const v = JSON.parse(res.body);
    if (Array.isArray(v)) {
      const shown = v.slice(0, 3);
      return { text: JSON.stringify(shown, null, 2) + (v.length > 3 ? `\n… ${v.length - 3} more rows` : ""), count: v.length, bytes };
    }
    return { text: JSON.stringify(v, null, 2), bytes };
  } catch {
    return { text: res.body, bytes };
  }
}

export function RangeLab({ lab }: { lab: LabId }) {
  const def = LABS[lab];
  const server = useRef<AclServer | null>(null);
  if (!server.current) server.current = new AclServer();
  const [, bump] = useState(0);
  const [tab, setTab] = useState<"repeater" | "admin">("repeater");
  const [req, setReq] = useState(def.starter);
  const [history, setHistory] = useState<{ req: typeof req; res: Res }[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [rawAll, setRawAll] = useState(false);
  const [hints, setHints] = useState(0);
  const [flag, setFlag] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [solved, setSolved] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [now, setNow] = useState(0);
  const s = server.current;

  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const send = (r = req) => {
    const res = s.handle(r);
    setHistory((h) => [{ req: { ...r }, res }, ...h].slice(0, 30));
    setSel(0);
    setRawAll(false);
    bump((n) => n + 1);
  };
  const admin = (field: string, editable: boolean) => {
    const res = s.handle({ method: "POST", path: `/admin/rules?field=${field}&editable=${editable}`, user: "acme-u1", body: "" });
    setHistory((h) => [{ req: { method: "POST", path: `/admin/rules?field=${field}&editable=${editable}`, user: "acme-u1", body: "" }, res }, ...h].slice(0, 30));
    setSel(0);
    bump((n) => n + 1);
  };

  const win = () => {
    if (solved) return;
    setSolved(true);
    recordLab(`Range: ${def.title}`, FLAGS[lab]);
    playFlag();
    triggerConfetti();
  };
  const submit = () => {
    if (flag.trim() === FLAGS[lab]) {
      setMsg({ ok: true, text: "Flag accepted. Now deploy the fix and watch the same request fail." });
      win();
    } else setMsg({ ok: false, text: "Not the flag. Look at the memo field of what you have read." });
  };
  const check = () => {
    if (s.solved(lab)) {
      setMsg({ ok: true, text: `Done: ${FLAGS[lab]}` });
      win();
    } else setMsg({ ok: false, text: lab === "tenant" ? "Globex account 1005 doesn't hold exactly 1,337 more cents yet." : "The email hasn't been changed while the field was locked." });
  };
  const deploy = () => {
    s.fixed.add(def.fixKey);
    setFixed(true);
    bump((n) => n + 1);
  };
  const reset = () => {
    server.current = new AclServer();
    setHistory([]);
    setSel(null);
    setFixed(false);
    setSolved(false);
    setMsg(null);
    setReq(def.starter);
    bump((n) => n + 1);
  };

  const cur = sel !== null ? history[sel] : null;
  const view = useMemo(() => (cur ? prettyBody(cur.res) : null), [cur]);
  const age = s.cacheAgeMs();
  void now;
  const showFull = cur && rawAll ? cur.res.body : null;

  return (
    <div className="rlab">
      <div className="rl-head">
        <span className="rl-tag">practice range</span>
        <span className="rl-title">{def.title}</span>
        {solved && <span className="rl-solved">✓ solved</span>}
        <button className="rl-reset" onClick={reset}>reset lab</button>
      </div>
      <p className="rl-goal">{def.goal}</p>

      <div className="rl-tabs">
        <button className={tab === "repeater" ? "on" : ""} onClick={() => setTab("repeater")}>Repeater</button>
        {def.admin && <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>Admin panel</button>}
      </div>

      {tab === "repeater" && (
        <div className="rl-grid">
          <div className="rl-col">
            <label className="rl-l">Logged in as</label>
            <select value={req.user} onChange={(e) => setReq({ ...req, user: e.target.value })}>
              {USERS.map((u) => <option key={u}>{u}</option>)}
            </select>
            <label className="rl-l">Request</label>
            <div className="rl-line">
              <select value={req.method} onChange={(e) => setReq({ ...req, method: e.target.value })}>
                {["GET", "POST", "PUT"].map((m) => <option key={m}>{m}</option>)}
              </select>
              <input value={req.path} onChange={(e) => setReq({ ...req, path: e.target.value })} spellCheck={false} aria-label="path" />
            </div>
            <label className="rl-l">Body (JSON)</label>
            <textarea value={req.body} onChange={(e) => setReq({ ...req, body: e.target.value })} spellCheck={false} rows={4} />
            <button className="rl-send" onClick={() => send()}>Send ▸</button>
            <div className="rl-hist">
              {history.length === 0 && <span className="rl-dim">Sent requests show up here.</span>}
              {history.map((h, i) => (
                <button key={i} className={`rl-h ${sel === i ? "on" : ""}`} onClick={() => { setSel(i); setRawAll(false); setReq(h.req); }}>
                  <b className={h.res.status < 300 ? "ok" : h.res.status < 500 ? "warn" : "bad"}>{h.res.status}</b> {h.req.method} {h.req.path.slice(0, 34)}
                </button>
              ))}
            </div>
          </div>
          <div className="rl-col">
            <label className="rl-l">Response</label>
            {cur && view ? (
              <>
                <div className="rl-meta">
                  <b className={cur.res.status < 300 ? "ok" : cur.res.status < 500 ? "warn" : "bad"}>{cur.res.status}</b>
                  <span>{view.bytes.toLocaleString()} bytes</span>
                  {view.count !== undefined && <span>{view.count.toLocaleString()} rows</span>}
                  <span>{cur.res.ms} ms</span>
                </div>
                <pre className="rl-out">{showFull ?? view.text}</pre>
                {view.count !== undefined && view.count > 3 && (
                  <button className="rl-link" onClick={() => setRawAll((v) => !v)}>{rawAll ? "show first 3 rows" : `show all ${view.count.toLocaleString()} rows (raw, long)`}</button>
                )}
              </>
            ) : (
              <div className="rl-dim">Press Send. The service answers here.</div>
            )}
          </div>
        </div>
      )}

      {tab === "admin" && (
        <div className="rl-admin">
          <p>You are the admin (acme-u1). The <code>email</code> field is <b>{s.rules.email ? "open" : "locked"}</b>. The service's rule cache is <b>{age === null ? "empty" : age > s.cacheTtlMs ? "expired" : `${(age / 1000).toFixed(1)} s old`}</b> (it lives {s.cacheTtlMs / 1000} s). {s.cache && <>It currently holds <code>email</code> as <b>{s.cache.rules.email ? "open" : "locked"}</b>, and an edit is judged by that copy until it expires.</>}</p>
          <div className="rl-line">
            <button onClick={() => admin("email", true)}>Open email for editing</button>
            <button onClick={() => admin("email", false)}>Lock email</button>
          </div>
          <p className="rl-dim">Each click sends POST /admin/rules?field=email&amp;editable=… as acme-u1. Switch back to Repeater to send requests as acme-u3.</p>
        </div>
      )}

      <div className="rl-actions">
        {(lab === "bola" || lab === "list") && (
          <div className="rl-flag">
            <input placeholder="FLAG{…}" value={flag} onChange={(e) => setFlag(e.target.value)} spellCheck={false} />
            <button onClick={submit}>Submit flag</button>
          </div>
        )}
        {(lab === "tenant" || lab === "window") && <button onClick={check}>Check my work</button>}
        <button onClick={() => setHints((h) => Math.min(h + 1, def.hints.length))}>Hint ({hints}/{def.hints.length})</button>
        <button className={fixed ? "done" : ""} onClick={deploy}>{fixed ? "Fix deployed ✓" : "Deploy the fix"}</button>
      </div>
      {msg && <div className={`rl-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
      {hints > 0 && <ol className="rl-hints">{def.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ol>}
      {fixed && (
        <div className="rl-fix">
          <b>The fix.</b> {def.fixNote}
          <pre>{def.fixCode}</pre>
        </div>
      )}
      <p className="rl-foot">Everything here is fictional and runs inside this page: no network, no real system. The Go version of the same service is in the book&apos;s repository (range/part3-ch13-acl).</p>
    </div>
  );
}
