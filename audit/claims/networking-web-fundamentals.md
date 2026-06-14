# Accuracy audit — networking-web-fundamentals

Chapter: `content/part-1/15-networking-web-fundamentals.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| UnderTheHood: "**Post-quantum key exchange (Go 1.26):** as of Go 1.26, `crypto/tls` enables hybrid post-quantum key exchange (`X25519MLKEM768`) by default in TLS 1.3 … you get quantum-resistant key exchange for free when both sides are Go 1.26+." (Also Recap line: "As of Go 1.26, `crypto/tls` enables hybrid post-quantum key exchange (`X25519MLKEM768`) by default.") | **OUTDATED / WRONG (version)** | go.dev/doc/go1.24: "The new post-quantum `X25519MLKEM768` key exchange mechanism … is now **enabled by default** when `Config.CurvePreferences` is nil." go.dev/doc/go1.26: what 1.26 newly enables by default is "The hybrid `SecP256r1MLKEM768` and `SecP384r1MLKEM1024` post-quantum key exchanges." | `X25519MLKEM768`-by-default is a **Go 1.24** feature, not Go 1.26. Fix to: "Since **Go 1.24**, `crypto/tls` enables `X25519MLKEM768` by default in TLS 1.3; Go 1.26 adds the `SecP256r1MLKEM768`/`SecP384r1MLKEM1024` hybrids by default too." Pin the right version (and note 1.24 GODEBUG `tlsmlkem=0` opt-out vs 1.26 `tlssecpmlkem=0`). |
| "HTTP/1.1 (**RFC 7230**, 2014 — the modernised restatement of RFC 2616 from 1999, still dominant)" (Define + body) | OUTDATED / IMPRECISE | rfc-editor.org/rfc/rfc9110: "Obsoletes: 2818, **7230**, 7231, …", "STD 97", "June 2022". RFC 7230 (2014) was itself obsoleted in 2022 by RFC 9110 (semantics) + 9112 (HTTP/1.1 messaging). | Not false as history (7230 was a 2014 restatement of 2616/1999), but stale as the *current* reference. Add: "core HTTP semantics now live in **RFC 9110 (2022)**, with HTTP/1.1 message syntax in **RFC 9112**; 7230/2616 are obsoleted." The audit brief explicitly anchors HTTP to RFC 9110/9111 — pin it. |
| "HTTP/2 (**RFC 7540**, 2015)" | IMPRECISE (stale RFC) | RFC 7540 (2015) is correct for HTTP/2's original spec but was obsoleted by **RFC 9113 (June 2022)**. (Caching directives, separately, are RFC 9111.) | Optionally update to "HTTP/2 (RFC 7540, 2015; obsoleted by RFC 9113, 2022)." Year and core mechanism (binary framing, streams, multiplexing) are correct; only the live-RFC pointer is stale. Low risk. |
| "TLS 1.3 … Cuts the handshake to **1 round-trip** (vs. 2 in TLS 1.2) … mandates perfect forward secrecy." / "TLS 1.3: one round-trip before data flows." | CORRECT | RFC 8446 (Aug 2018): TLS 1.3 full handshake is 1-RTT; "Static RSA and Diffie-Hellman cipher suites have been removed; all public-key based key exchange mechanisms now provide forward secrecy." | none — 1-RTT, mandatory PFS, removal of static RSA all confirmed. |
| "TLS 1.3 The current standard (**2018**)." | CORRECT | RFC 8446 published August 2018. | none |
| "Go's `crypto/tls` introduced TLS 1.3 support in **Go 1.12** and made it the **default in Go 1.13**." | CORRECT | go.dev/doc/go1.13: "As announced in Go 1.12, Go 1.13 enables support for TLS 1.3 in the `crypto/tls` package by default. … The opt-out will be removed in Go 1.14." | none — both version pins confirmed. |
| "TLS 1.3 mandates **ephemeral Diffie-Hellman** for all key exchanges (ECDHE) … the shared secret is never transmitted … perfect forward secrecy (PFS). TLS 1.2 made PFS optional; TLS 1.3 made it mandatory." | CORRECT | RFC 8446: "all public-key based key exchange mechanisms now provide forward secrecy" (ephemeral (EC)DHE required; static RSA removed). | none |
| "**13 clusters** of root servers (a.root-servers.net through m.root-servers.net)" | CORRECT | en.wikipedia.org/wiki/Root_name_server: "limit the number of root servers to thirteen server addresses" (a–m), each fronting many anycast instances. | none — "clusters" (anycast-fronted) is the right framing. |
| "DNS is UDP by default (port 53). Responses over **512 bytes** fall back to TCP." | CORRECT | Classic DNS/RFC 1035 512-byte UDP message limit; TCP fallback for larger responses. (EDNS0 can extend UDP payload, but the 512→TCP rule is the standard teaching baseline and is stated as the default.) | Optional nuance: with EDNS0 the UDP payload can exceed 512 before TCP fallback. Not required — the baseline statement is correct. |
| "**Context-aware dial methods (Go 1.26):** `net.Dialer` gains `DialTCP`, `DialUDP`, `DialIP`, and `DialUnix` that accept a `context.Context` directly … returns a `*net.TCPConn` … without a type assertion." (Also Recap line.) | CORRECT | go.dev/doc/go1.26: "The new `Dialer` methods `DialIP`, `DialTCP`, `DialUDP`, and `DialUnix` permit dialing specific network types with context values." | none — Go 1.26 version pin confirmed. |
| TCP 3-way handshake SYN→SYN-ACK→ACK with ISN+seq/ack numbers; "ESTABLISHED"; `Accept()` returns a `net.Conn` (connected socket), listening socket stays open; 5-tuple uniqueness | CORRECT | Standard TCP/socket semantics (RFC 793 lineage) + Go net package behavior; QuickCheck answer (Accept returns a per-client net.Conn, no new port, 5-tuple distinguishes) is right. | none |
| Netpoller: `conn.Read()` parks the goroutine (not the OS thread) via epoll/kqueue/IOCP; goroutine stack ~2 KB grown on demand vs OS thread 1–8 MB | CORRECT (conceptual) | Matches documented Go runtime netpoller behavior; stack-size figures are the standard order-of-magnitude framing (initial goroutine stack ~2 KB/8 KB region, grown on demand). | none |
| SNI sent in ClientHello in **plaintext**; ECH is the in-progress fix; HTTP/2 negotiated via **ALPN** during TLS handshake | CORRECT | RFC 6066 (SNI) + RFC 7301 (ALPN); SNI is unencrypted in the ClientHello, ECH (Encrypted Client Hello) is the IETF draft fix. | none |
| Go 1.22 ServeMux: registering `POST /checkout` returns **405** for non-POST to that path (Lab Check 3 + hint) | CORRECT | go1.22 enhanced `http.ServeMux` with method+path patterns; a request to a registered path with an unregistered method yields 405 Method Not Allowed. | none |
| Exercise 4 prose: "Since Go 1.22, loop variables are per-iteration, so the old `domain := domain` re-declaration is no longer needed." | CORRECT | go.dev/doc/go1.22: "the loop variable … is now per-iteration instead of per-loop." | none |

## CORRECT (verified, not individually tabled)

Socket = kernel fd identified by a 5-tuple; `net.Listen`/`net.Dial`/`io.Copy` echo server; UDP connectionless/unreliable vs TCP reliable ordered stream; HTTP/1.1 text framing with CRLF + keep-alive + in-order responses ⇒ head-of-line blocking; HTTP/2 binary frames, numbered streams, multiplexing, HPACK, server push (largely superseded); HTTP/2 still has TCP-layer HOL on packet loss, HTTP/3 over QUIC (UDP) fixes it with per-stream loss recovery; DNS hierarchy (recursive resolver → root → TLD → authoritative), TTL caching, A/AAAA/CNAME/MX/TXT/NS records, CNAME-not-at-apex; pure-Go vs cgo resolver (`GODEBUG=netdns=go|cgo`); `tls.Dial` verifies the chain against system roots, `InsecureSkipVerify` defeats authentication; latency-budget figures presented as illustrative ranges. All consistent with the relevant RFCs and Go package docs.

**CORRECT count (verified claims): ~28** (12 tabled CORRECT + ~16 swept).

## Worst finding

**OUTDATED / WRONG (version attribution):** the chapter twice states that `crypto/tls` enables `X25519MLKEM768` hybrid post-quantum key exchange "as of Go 1.26 … by default." That default landed in **Go 1.24** (go.dev/doc/go1.24 verbatim: "now enabled by default when `Config.CurvePreferences` is nil"). What Go 1.26 newly enables by default is a *different* pair — `SecP256r1MLKEM768` and `SecP384r1MLKEM1024`. A reader is handed both a wrong version and a wrong "you only get this on 1.26+" gate. Proposed fix: attribute `X25519MLKEM768`-by-default to Go 1.24 and describe the SecP*-hybrids as the 1.26 addition.

## Sources fetched
- https://go.dev/doc/go1.26 (SecP256r1MLKEM768/SecP384r1MLKEM1024 default; Dialer DialTCP/DialUDP/DialIP/DialUnix)
- https://go.dev/doc/go1.24 (X25519MLKEM768 enabled by default — the real version)
- https://go.dev/doc/go1.13 (TLS 1.3 default in 1.13, introduced 1.12)
- https://www.rfc-editor.org/rfc/rfc9110.html (HTTP Semantics, June 2022, obsoletes 7230/7231/2616)
- https://datatracker.ietf.org/doc/html/rfc8446 (TLS 1.3, Aug 2018, 1-RTT, mandatory forward secrecy, static RSA removed)
- https://en.wikipedia.org/wiki/Root_name_server (13 root server addresses a–m, anycast)

## Tally
- Flagged rows: 14 (1 OUTDATED/WRONG version to fix; 2 IMPRECISE/stale-RFC to update; 11 CORRECT-but-tabled)
- CORRECT (verified): ~28
- WRONG: 0 outright · OUTDATED: 1 (X25519MLKEM768 attributed to 1.26 not 1.24) · IMPRECISE: 2 (HTTP/1.1 RFC 7230 vs 9110/9112; HTTP/2 RFC 7540 vs 9113) · UNVERIFIABLE: 0
- Content file edited: NO (report-only)
