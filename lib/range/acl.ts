/* ════════════════════════════════════════════
   The chapter-13 accounts service, as a small
   in-page "server". It mirrors range/part3-ch13-acl
   (the Go module the chapter measures): 3,000
   accounts across three banks, sequential ids, the
   leaky v0 routes and the scoped v1 routes, and
   the profile editor whose rule cache lags an
   admin's change.

   Everything here is fictional data in this
   browser tab. No network, no real system.
   ════════════════════════════════════════════ */

export type Req = { method: string; path: string; user: string; body: string };
export type Res = { status: number; headers: Record<string, string>; body: string; ms: number; note?: string };

const TENANTS = ["acme", "globex", "initech"] as const;
export const USERS = TENANTS.flatMap((t) => [1, 2, 3, 4].map((n) => `${t}-u${n}`));
const role = (u: string) => (u.endsWith("-u1") || u.endsWith("-u2") ? "admin" : "viewer");
const tenantOf = (u: string) => u.split("-")[0];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FLAGS = {
  bola: "FLAG{bola-sequential-ids}",
  list: "FLAG{list-with-no-scope}",
  tenant: "FLAG{tenant-from-the-body}",
  window: "FLAG{decide-then-write}",
} as const;
export type LabId = keyof typeof FLAGS;

type Account = { id: number; tenant_id: string; owner_id: string; balance: number; memo: string };
type Profile = { first_name: string; last_name: string; email: string; address: string };

const CACHE_TTL_MS = 5000;
const FIELDS = ["first_name", "last_name", "email", "address"] as const;

export class AclServer {
  accounts: Account[] = [];
  profiles: Record<string, Profile> = {};
  rules: Record<string, boolean> = { first_name: true, last_name: true, email: false, address: false };
  cache: { rules: Record<string, boolean>; at: number } | null = null;
  /** routes the reader has "deployed a fix" for */
  fixed = new Set<string>();
  tenantStart = 0;
  emailStart = "";
  /** the state a lab's win condition looks at */
  emailChangedWhileLocked = false;

  constructor() {
    const r = rng(42);
    for (let i = 0; i < 3000; i++) {
      const owner = USERS[i % 12];
      this.accounts.push({ id: 1001 + i, tenant_id: tenantOf(owner), owner_id: owner, balance: 1000 + Math.floor(r() * 90000), memo: "" });
    }
    this.acct(3999).memo = FLAGS.bola;
    this.acct(2500).memo = FLAGS.list;
    for (const u of USERS) this.profiles[u] = { first_name: `First-${u}`, last_name: `Last-${u}`, email: `${u}@example.com`, address: "1 Meridian Way" };
    this.tenantStart = this.acct(1005).balance;
    this.emailStart = this.profiles["acme-u4"].email;
  }

  acct(id: number): Account {
    return this.accounts[id - 1001];
  }

  private json(status: number, v: unknown, extra: Record<string, string> = {}): Res {
    return { status, headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(v), ms: 0 };
  }
  private text(status: number, s: string): Res {
    return { status, headers: { "content-type": "text/plain" }, body: s + "\n", ms: 0 };
  }

  private cachedRules(): Record<string, boolean> {
    const now = Date.now();
    if (!this.cache || now - this.cache.at > CACHE_TTL_MS) this.cache = { rules: { ...this.rules }, at: now };
    return this.cache.rules;
  }
  cacheAgeMs(): number | null {
    return this.cache ? Date.now() - this.cache.at : null;
  }
  cacheTtlMs = CACHE_TTL_MS;

  handle(req: Req): Res {
    const t0 = performance.now();
    const res = this.route(req);
    res.ms = Math.round((performance.now() - t0) * 10) / 10;
    return res;
  }

  private route(req: Req): Res {
    const url = new URL(req.path, "http://range.local");
    const p = url.pathname;
    const user = USERS.includes(req.user) ? req.user : null;
    if (!user) return this.text(401, "unauthenticated");
    const tenant = tenantOf(user);
    let m: RegExpMatchArray | null;

    // ---- accounts ----
    if (req.method === "GET" && (m = p.match(/^\/(v[012])\/accounts\/(\d+)$/))) {
      const v = m[1];
      const a = this.accounts[Number(m[2]) - 1001];
      if (v === "v0" && !this.fixed.has("account")) return a ? this.json(200, a) : this.text(404, "not found");
      const mine = a && a.owner_id === user && a.tenant_id === tenant;
      if (v === "v2") return mine ? this.json(200, a) : this.text(a ? 403 : 404, a ? "forbidden" : "not found");
      return mine ? this.json(200, a) : this.text(404, "not found");
    }
    if (req.method === "GET" && (m = p.match(/^\/(v[01])\/accounts$/))) {
      if (m[1] === "v0" && !this.fixed.has("list")) return this.json(200, this.accounts);
      return this.json(200, this.accounts.filter((a) => a.owner_id === user));
    }
    // ---- credits ----
    if (req.method === "POST" && (m = p.match(/^\/(v[01])\/credits$/))) {
      let b: { tenant_id?: string; account_id?: number; amount?: number };
      try {
        b = JSON.parse(req.body || "{}");
      } catch {
        return this.text(400, "bad request");
      }
      const useBody = m[1] === "v0" && !this.fixed.has("tenant");
      const t = useBody ? b.tenant_id : tenant;
      const a = typeof b.account_id === "number" ? this.accounts[b.account_id - 1001] : undefined;
      if (!a || a.tenant_id !== t || typeof b.amount !== "number") return this.text(404, "not found");
      a.balance += b.amount;
      return this.json(200, { balance: a.balance });
    }
    // ---- profiles ----
    if (req.method === "GET" && (m = p.match(/^\/profiles\/([\w-]+)$/))) {
      const pr = this.profiles[m[1]];
      return pr && tenantOf(m[1]) === tenant ? this.json(200, pr) : this.text(404, "not found");
    }
    if (req.method === "PUT" && (m = p.match(/^\/(v[01])\/profiles\/([\w-]+)$/))) {
      const target = m[2];
      if (!this.profiles[target] || tenantOf(target) !== tenant) return this.text(404, "not found");
      let ch: Record<string, string>;
      try {
        ch = JSON.parse(req.body || "{}");
      } catch {
        return this.text(400, "bad request");
      }
      const names = Object.keys(ch);
      if (!names.length || names.some((n) => !(FIELDS as readonly string[]).includes(n))) return this.text(400, "bad request");
      const guarded = m[1] === "v1" || this.fixed.has("window");
      // v0 decides from a cached copy of the rules; v1 reads the live rules in the same step as the write
      const rules = guarded ? this.rules : this.cachedRules();
      if (names.some((n) => !rules[n])) return this.text(403, "forbidden");
      for (const n of names) this.profiles[target][n as keyof Profile] = ch[n];
      if (!this.rules.email && names.includes("email") && target === "acme-u4") this.emailChangedWhileLocked = true;
      return this.text(200, "updated");
    }
    if (req.method === "POST" && p === "/admin/rules") {
      if (role(user) !== "admin") return this.text(403, "forbidden");
      const f = url.searchParams.get("field") ?? "";
      if (!(FIELDS as readonly string[]).includes(f)) return this.text(400, "unknown field");
      this.rules[f] = url.searchParams.get("editable") === "true";
      return this.text(200, "rule set");
    }
    return this.text(404, "no such route");
  }

  /** Has the reader met the lab's win condition? */
  solved(lab: LabId): boolean {
    switch (lab) {
      case "tenant":
        return this.acct(1005).balance - this.tenantStart === 1337;
      case "window":
        return this.emailChangedWhileLocked && !this.rules.email;
      default:
        return false; // bola and list are solved by finding the flag
    }
  }
}
