# Accuracy audit — http-clients (part-1/16)

REPORT ONLY. No content file edited. Claims verified against fetched primary sources (see tally at end).

| # | Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|---|
| 1 | "`http.DefaultClient` ... is defined as `var DefaultClient = &Client{}`" / zero value, no timeout | CORRECT | pkg.go.dev/net/http: `var DefaultClient = &Client{}`; zero-value Client, Timeout defaults to 0 = no timeout | None |
| 2 | "`http.Client.Timeout` is the end-to-end deadline ... covers dialing, the TLS handshake, sending the request, and reading the full response body" | CORRECT | pkg.go.dev/net/http Client.Timeout: "The timeout includes connection time, any redirects, and reading the response body. The timer remains running after Get/Head/Post/Do return and will interrupt reading of the Response.Body." | None |
| 3 | QuickCheck: "DefaultClient.Timeout equals 0 — no timeout at all" | CORRECT | Same as #1; zero value of time.Duration is 0 | None |
| 4 | "`MaxIdleConnsPerHost` ... Default 2, which is surprisingly small" (and Recap: "default 2 is too low") | CORRECT | go.dev/src/net/http/transport.go: `const DefaultMaxIdleConnsPerHost = 2`; field doc: "If zero, DefaultMaxIdleConnsPerHost is used." | None |
| 5 | "`MaxIdleConns` — the absolute cap on idle connections across all hosts. **Default 100.** Zero means no limit." | IMPRECISE | transport.go field doc: "MaxIdleConns ... Zero means no limit." `100` is only the value set in `DefaultTransport`, not the field's zero-value default. The two sentences contradict ("Default 100" vs "Zero means no limit"). | Tighten: "Zero means no limit; `http.DefaultTransport` sets it to 100." Drop the bare "Default 100." |
| 6 | "ResponseHeaderTimeout fires if the server takes more than 5s to send the status line and headers" | CORRECT | transport.go: "ResponseHeaderTimeout, if non-zero, specifies the amount of time to wait for a server's response headers after fully writing the request ... does not include the time to read the response body." | None |
| 7 | "TLSHandshakeTimeout — how long the TLS handshake may take" | CORRECT | transport.go: "TLSHandshakeTimeout specifies the maximum amount of time to wait for a TLS handshake. Zero means no timeout." | None |
| 8 | "IdleConnTimeout — how long an idle connection can sit in the pool" | CORRECT | transport.go: "IdleConnTimeout is the maximum amount of time an idle (keep-alive) connection will remain idle before closing itself. Zero means no limit." | None |
| 9 | "DialContext.Timeout fires if the server IP never accepts the connection" + "(it covers DNS + connect together)" | CORRECT | net.Dialer.Timeout covers DNS resolution + connect; matches dialer semantics. JourneyAnim's "Guard: the Dialer's Timeout (it covers DNS + connect together)" is accurate. | None |
| 10 | Pool "keyed by `{scheme, host, port}`" / "`http://` and `https://` use separate pools" / "Connections are not shared between clients" | CORRECT | Matches Transport connection-pool behavior (connectMethodKey includes scheme+addr+proxy); each Transport has its own idleConn map. | None |
| 11 | "to reuse the connection, you must also read the body to completion before closing it" / drain-and-close rule | CORRECT | pkg.go.dev Client.Do: "If the Body is not both read to EOF and closed, the Client's underlying RoundTripper (typically Transport) may not be able to re-use a persistent TCP connection." | None |
| 12 | "`http.NewRequest` attaches `context.Background()` — a context that is never cancelled" | CORRECT | go.dev/src/net/http/request.go: "NewRequest wraps [NewRequestWithContext] using [context.Background]." | None |
| 13 | "io.ReadAll was reworked ... roughly 2x throughput and ~50% fewer allocations" (Go 1.26) | CORRECT | go.dev/doc/go1.26 io section: "ReadAll now allocates less intermediate memory and returns a minimally sized final slice. It is often about two times faster while typically allocating around half as much total memory, with more benefit for larger inputs." | None (version-pinned correctly) |
| 14 | "As of Go 1.26, `net.Dialer` gained explicit `DialTCP` and related methods that accept a `context.Context`" | CORRECT | go.dev/doc/go1.26 net section: "The new Dialer methods DialIP, DialTCP, DialUDP, and DialUnix permit dialing specific network types with context values." | None |
| 15 | "ResponseHeaderTimeout ... THIS is where the zero-value http.Client waits FOREVER" (JourneyAnim phase 4 — the wait-for-headers stall) | CORRECT | A zero-value Client/Transport sets none of these timeouts; with no Client.Timeout the wait for response headers is unbounded. Consistent with field docs (all timeouts "if non-zero"/"Zero means no timeout"). | None |
| 16 | Retry section: "Only retry idempotent requests ... GET is always safe to retry. POST /charge is not" | CORRECT (conceptual) | Standard idempotency guidance; consistent with HTTP method semantics (RFC 9110 idempotent methods). Not a Go-internals claim. | None |

## CORRECT (confirmed against fetched sources): 15 of 16
## Flagged rows: 1 (row 5 — IMPRECISE, MaxIdleConns "Default 100")

Worst finding: row 5 — the `<UnderTheHood>` block states `MaxIdleConns` "Default 100. Zero means no limit." The field's actual zero-value default is "no limit" (per transport.go field doc); `100` is only the value in `http.DefaultTransport`. The two clauses contradict. Low severity (no reader will be handed a wrong mental model of behavior, only of which number is the "default"), but it is the only imprecision in an otherwise clean chapter.

## Sources fetched
- https://pkg.go.dev/net/http (DefaultClient, Client.Timeout, DefaultMaxIdleConnsPerHost, Client.Do body-reuse rule)
- https://pkg.go.dev/net/http#NewRequest
- https://go.dev/src/net/http/request.go (NewRequest = NewRequestWithContext + context.Background)
- https://go.dev/src/net/http/transport.go (Transport field docs, DefaultMaxIdleConnsPerHost=2, DefaultTransport MaxIdleConns=100/TLSHandshakeTimeout=10s)
- https://go.dev/doc/go1.26 (io.ReadAll ~2x faster; net.Dialer DialTCP/DialIP/DialUDP/DialUnix context methods)

Frontmatter unchanged: yes (no content file edited)
