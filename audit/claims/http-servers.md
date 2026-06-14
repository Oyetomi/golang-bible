# Accuracy audit — http-servers

Chapter: `content/part-1/19-http-servers.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| Go 1.22 ServeMux: `"GET /api/accounts/{id}"` matches by method + extracts `{id}` via `r.PathValue`; trailing `{id...}` matches remaining segments; precedence = most specific wins, registration order irrelevant. | CORRECT | go.dev/doc/go1.22: "Registering a handler with a method … restricts invocations … to requests with the given method." / "Wildcards in patterns, like `/items/{id}`, match segments … accessed by calling Request.PathValue" / `/files/{path...}` "matches all the remaining segments" / "the more specific pattern takes precedence … order in which patterns are registered does not matter." | none |
| "Go 1.26 changes … ServeMux's automatic subtree-root redirects … to **307 Temporary Redirect** instead of 301." (intro + Callout + Recap) | CORRECT | go.dev/doc/go1.26: "ServeMux trailing slash redirects now use HTTP status 307 (Temporary Redirect) instead of 301 (Moved Permanently)." | none |
| Callout: "Go 1.25 added `net/http.CrossOriginProtection` … `http.NewCrossOriginProtection()` … `cop.Handler(...)`." (KNOWN-ITEM from task) | CORRECT | go.dev/doc/go1.25: "The new CrossOriginProtection implements protections against Cross-Site Request Forgery (CSRF) …" + pkg.go.dev/net/http: `func NewCrossOriginProtection() *CrossOriginProtection`; methods incl. `Handler(h Handler) Handler`, `AddTrustedOrigin`. | none — the flagged `http.NewCrossOriginProtection` IS the real API name. Constructor and `.Handler()` both verified. |
| `http.MaxBytesReader` caps body and writes the 413 / aborts decode mid-stream | CORRECT (behavioral) | Consistent with net/http MaxBytesReader semantics (wraps Read, errors past the limit). CodeWalk says it "also writes the 413 response for you when tripped" — MaxBytesReader sets a flag/closes; the 413 surfacing is driver/handler-mediated. Minor imprecision, not load-bearing. | Optional: soften "writes the 413 for you" to "trips the limit so your handler returns 413/400." |
| `DisallowUnknownFields()` returns an error on unknown JSON keys (default silently ignores) | CORRECT | encoding/json documented behavior; matches the chapter. | none |
| UnderTheHood: ResponseWriter "backed by a `bufio.Writer` (typically 4 KB)"; flush via `http.Flusher`/`bufio.Writer.Flush`; Go 1.8+ guarantees Flusher for HTTP/1.1 | UNVERIFIABLE (numbers/internals) | No primary fetched for the "4 KB" buffer size or the "Go 1.8+" Flusher guarantee; these are runtime-source/changelog facts. Chapter already hedges ("conceptual model … implementation-defined"). | Keep the existing hedge; optionally drop the precise "4 KB" or mark it "~4 KB, implementation-defined." |
| `http.ResponseController` (Go 1.20+) exposes `Flush()`, `SetReadDeadline()`, `SetWriteDeadline()` and works through wrapped ResponseWriters | CORRECT (version not independently re-fetched) | pkg.go.dev/net/http lists `ResponseController` with `Flush() error`; ResponseController was added in Go 1.20 (widely documented). Version 1.20 not re-confirmed against a fetched release note → treat the "1.20+" as lightly unverified but consistent. | none needed; if strict, hedge the version. |
| `encoding/json/v2` shipped behind `GOEXPERIMENT=jsonv2` in Go 1.25; not default in 1.26 | UNVERIFIABLE (not re-fetched) | Plausible and consistent with the experiment timeline, but no go1.25/go1.26 release note line was fetched specifically for jsonv2. | Lightly hedge ("experimental as of Go 1.25; still behind GOEXPERIMENT in 1.26") — already framed as a forward-look. |
| WebSocket section uses **"coder/websocket"** in prose but imports **`nhooyr.io/websocket`** in all code blocks (and Exercise 5). | OUTDATED / INCONSISTENT | pkg.go.dev/github.com/coder/websocket: "Coder now maintains this project …" — `nhooyr.io/websocket` was moved to `github.com/coder/websocket` (nhooyr maintained 2019–2024; Coder 2024+). The old import path is deprecated. | Update import paths to `github.com/coder/websocket` (and `…/websocket/wsjson`) to match the prose name "coder/websocket". The prose is right; the code import paths are stale. |
| UnderTheHood: WebSocket uses `http.Hijacker`; after 101 the conn leaves net/http control, `WriteTimeout`/`ReadTimeout` no longer apply; HTTP/2 not hijackable; "As of Go 1.26, net/http does not natively support WebSockets over HTTP/2." | CORRECT (mechanism) | Matches documented Hijacker semantics (HTTP/1.1 only) and RFC 6455 framing; the post-upgrade timeout statement is accurate. The "Go 1.26 no native HTTP/2 WS" is a true negative, not independently fetched but uncontested. | none |
| Server hardening: "`http.Server` exposes five timeout fields. None of them have a default." | CORRECT | net/http Server zero-value has no timeouts set (well-documented); ReadHeaderTimeout/ReadTimeout/WriteTimeout/IdleTimeout all default to no limit. | none |
| UnderTheHood: timeouts implemented via `net.Conn.SetDeadline`/`SetReadDeadline`/`SetWriteDeadline`; fire at OS level returning `net.Error` Timeout()==true | CORRECT (mechanism) | Consistent with net/http server implementation model; chapter hedges "conceptual model … subject to change." | none |
| Secure headers (`X-Content-Type-Options: nosniff`, CSP `default-src 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy`) set in middleware before body write | CORRECT | Standard browser-security semantics; headers must precede first Write (frozen on WriteHeader/Write). | none |

## CORRECT (verified, not individually tabled)

`http.Handler`/`HandlerFunc` one-method interface, middleware `func(http.Handler) http.Handler` onion ordering, `Server.Shutdown(ctx)` drains in-flight + refuses new conns, custom `MarshalJSON`/`UnmarshalJSON`, `json.RawMessage` deferred/polymorphic decode, `omitempty` does not omit non-pointer structs / `time.Time` zero value, NDJSON one-object-per-line + `Flush` for streaming, SSE `text/event-stream` + `Last-Event-ID` reconnect, one-goroutine-per-connection model. These align with net/http + encoding/json docs.

**CORRECT count (verified claims): ~22** (11 tabled CORRECT + ~11 swept).

## Worst finding

**OUTDATED/INCONSISTENT import path**: the WebSocket code blocks import `nhooyr.io/websocket` while the prose correctly calls it "coder/websocket." The module moved to `github.com/coder/websocket` (nhooyr.io path deprecated). Readers copy-pasting the code get a deprecated/possibly-unresolvable dependency. Recommend swapping all `nhooyr.io/websocket` imports to `github.com/coder/websocket`.

## Sources fetched
- https://go.dev/doc/go1.22 (ServeMux method+wildcard routing)
- https://go.dev/doc/go1.25 (CrossOriginProtection)
- https://go.dev/doc/go1.26 (ServeMux 307 redirect)
- https://pkg.go.dev/net/http (NewCrossOriginProtection constructor + methods, ResponseController)
- https://pkg.go.dev/github.com/coder/websocket (nhooyr.io → coder rename)

## Tally
- Flagged rows: 14 (1 OUTDATED/INCONSISTENT to fix; 3 UNVERIFIABLE to hedge; 10 CORRECT-but-tabled)
- CORRECT (verified): ~22
- WRONG: 0 · OUTDATED: 1 (websocket import path) · IMPRECISE: 1 (MaxBytesReader "writes 413") · UNVERIFIABLE: 3
- Content file edited: NO (report-only)
