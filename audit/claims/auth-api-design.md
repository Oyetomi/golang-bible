# Accuracy audit — auth-api-design

Chapter: `content/part-1/20-auth-api-design.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| "As of Go 1.26, several `crypto/*` generators **ignore a caller-supplied `io.Reader`** and always draw from the OS entropy pool — you cannot accidentally weaken them." (UnderTheHood) AND "As of Go 1.26, `crypto/rand` always uses OS entropy — you cannot accidentally weaken it." (OAuth code comment + Recap) | IMPRECISE (conflates two changes; partly mis-stated) | pkg.go.dev/crypto/rand (Prime): "Since Go 1.26, a secure source of random bytes is always used, and the Reader is ignored unless GODEBUG=cryptocustomrand=1 is set." → so "ignore caller-supplied io.Reader" is TRUE for Go 1.26 (for rand-taking generators like Prime/Int and crypto key-gen), confirming the 1.26 attribution. BUT go.dev/doc/go1.24 separately says: "The Read function is now guaranteed not to fail … always return nil as the error result … only affect programs that override the Reader variable." The blanket claim "crypto/rand always uses OS entropy — you cannot accidentally weaken it" overreaches: `crypto/rand.Reader` is still a package var that CAN be overridden (the 1.24 note explicitly calls out programs that override Reader). | Tighten: distinguish (a) Go 1.24 — `rand.Read` never returns an error (crashes instead); (b) Go 1.26 — generators that take a `rand io.Reader` argument ignore it and use the OS pool (override only via `GODEBUG=cryptocustomrand=1`). Drop the absolute "you cannot accidentally weaken it" — overriding `rand.Reader` is still possible. |
| bcrypt internals: "Generates **16 random bytes** from `crypto/rand` — this is the salt." (UnderTheHood) | CORRECT | bcrypt salt is 128-bit (16 bytes) per the algorithm; consistent with golang.org/x/crypto/bcrypt. pkg.go.dev confirms GenerateFromPassword produces the standard `$2a$cost$<22-char salt><31-char hash>` form (22 base64 chars = 16 bytes). | none |
| bcrypt: "at cost 12, one hash takes ~250ms on a modern CPU"; "Cost 12 is a good default in 2026" | UNVERIFIABLE (timing) | No primary source for the "~250ms at cost 12" figure (hardware-dependent). OWASP recommends bcrypt work factor "minimum of 10." Cost 12 is reasonable and above the floor. | Hedge the timing: "tens-to-hundreds of ms, hardware-dependent." Keep cost 12 as a defensible default. |
| bcrypt cost constants implied (DefaultCost, MinCost, MaxCost) — chapter uses cost 12 and cost 10 in examples | CORRECT | pkg.go.dev/golang.org/x/crypto/bcrypt: MinCost=4, MaxCost=31, DefaultCost=10. Both 10 and 12 are valid. | none. NOTE (not in chapter, optional enrichment): bcrypt has a 72-byte password limit ("GenerateFromPassword does not accept passwords longer than 72 bytes") — the chapter never mentions this; worth a one-line caveat. |
| argon2id default params: `Memory: 64*1024` (64 MiB), `Iterations: 3`, `Parallelism: 2`; "64MB is a reasonable start" / "~100-300ms" | CORRECT | OWASP Password Storage Cheat Sheet recommends argon2id minimum "m=19456 (19 MiB), t=2, p=1"; 64 MiB / t=3 exceeds the minimum. Defensible. | none |
| `bcrypt.CompareHashAndPassword` "runs in constant time" (Callout) | CORRECT (intent) | The comparison of the derived hash is constant-time (`subtle.ConstantTimeCompare` internally); matches "never use == for secrets." | none |
| `errors.Is(err, jwt.ErrTokenExpired)` distinguishes expiry; "Go 1.26 adds errors.AsType[T]" | CORRECT | go.dev/doc/go1.26: "The new AsType function is a generic version of As." jwt/v5 wraps `ErrTokenExpired` (library behavior, consistent). | none |
| JWT `alg:none` attack: "The spec (RFC 7519) allows an algorithm of `none`" / key-function must pin the method | CORRECT | RFC 7519/7515 define `"none"` (Unsecured JWS); the golang-jwt/v5 keyfunc-must-validate-method defense is correct and standard. | Minor: `"none"` is defined in RFC 7518 (JWA) / RFC 7515 (JWS) rather than 7519 (JWT claims), but 7519 references the JWS/JWA suite — acceptable shorthand, not a defect. |
| TOTP: `HMAC-SHA1(secret, floor(unixTime/30))`, dynamic truncation, mod 10^6; animation shows code **"196 119"** for the demo secret/time | CORRECT (computed) | Recomputed in Go (RFC 6238/4226 algorithm, secret "meridian-demo-secret", t=1781254800 → step 59375160): output **196119**. Matches the animation and the GoPlayground "exact code" comment. Neighbors: step-1=582356, step+1=087094. | none |
| TOTP uses SHA-1 "and here, that's fine … collision resistance isn't the property doing the work" | CORRECT (crypto reasoning) | Accurate: HMAC relies on PRF security, not collision resistance; RFC 6238 standardizes HMAC-SHA1. | none |
| Passkeys/WebAuthn: browser writes real origin into `clientDataJSON`; per-rpID scoping; server stores only public key; signature counter (decrease = cloned key alarm, synced passkeys report 0) | CORRECT (conceptual) | Matches W3C WebAuthn / FIDO2 model and `github.com/go-webauthn/webauthn` semantics. The "treat a decrease (not a zero) as the alarm" nuance is correct for synced passkeys. | none |
| `net/http.CrossOriginProtection` (Go 1.25): `http.NewCrossOriginProtection()`, `cop.AddTrustedOrigin(...)`, `cop.Handler(mux)`; validates Sec-Fetch-Site/Origin metadata | CORRECT | go.dev/doc/go1.25 + pkg.go.dev/net/http: constructor `NewCrossOriginProtection() *CrossOriginProtection`; methods `AddTrustedOrigin(origin string) error`, `Handler(h Handler) Handler`. Code in this chapter matches the real API exactly. | none |
| CSRF: `SameSite=Lax` blocks cross-site POST but not top-level GET; bearer-header APIs largely immune; double-submit / synchronizer token | CORRECT | Standard web-security canon; SameSite semantics accurate. | none |
| Cursor vs offset pagination; status codes (401 vs 403, 422 semantic); ORDER BY cannot be parameterized → safelist | CORRECT | SQL/HTTP standards; placeholders bind values not identifiers — the ORDER BY safelist reasoning is correct and important. | none |

## CORRECT (verified, not individually tabled)

Password-hash threat model (fast hashes crackable on GPU; bcrypt/argon2id deliberately slow + memory-hard), verification-token rules (CSPRNG, store hash not token, expire, single-use, constant-time compare), `crypto/subtle.ConstantTimeCompare` for non-bcrypt secrets, sessions (instant revocation) vs JWT (stateless) trade-off, OAuth2 authorization-code flow with `state` CSRF guard and back-channel `client_secret` exchange, OIDC `sub` as stable id, access vs refresh token pattern, RS256 = asymmetric/JWKS trust boundary, RBAC permission codes + `requirePermission` middleware (401 vs 403), idempotency-key replay, REST resource design, OpenAPI spec-first, GraphQL over/under-fetch + server-side N+1/dataloader. Align with the cited specs and stdlib.

**CORRECT count (verified claims): ~30** (13 tabled CORRECT + ~17 swept).

## Worst finding

**IMPRECISE (the one real defect): the Go 1.26 `crypto/rand` framing.** The chapter says, in three places, that "crypto/rand always uses OS entropy — you cannot accidentally weaken it." The accurate picture is two distinct changes: Go 1.24 made `crypto/rand.Read` non-failing (`Reader` is still an overridable package var — the 1.24 note explicitly flags programs that override it), and Go 1.26 made rand-taking generators *ignore* their supplied `io.Reader` (escape hatch: `GODEBUG=cryptocustomrand=1`). The blanket "cannot accidentally weaken it" overstates the guarantee. The 1.26 version attribution for "ignore caller-supplied io.Reader" is, however, CORRECT.

## Sources fetched
- https://pkg.go.dev/golang.org/x/crypto/bcrypt (MinCost/MaxCost/DefaultCost=10, 72-byte limit, salt-in-hash)
- https://pkg.go.dev/crypto/rand (Prime: "Since Go 1.26 … Reader is ignored unless GODEBUG=cryptocustomrand=1")
- https://go.dev/doc/go1.24 (crypto/rand.Read never fails; Reader still overridable)
- https://go.dev/doc/go1.26 (errors.AsType[T])
- https://go.dev/doc/go1.25 + https://pkg.go.dev/net/http (CrossOriginProtection API — re-used from http-servers audit)
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (argon2id m=19456/t=2 min; bcrypt cost min 10; 72-byte limit)
- TOTP value recomputed locally in Go (RFC 6238) → 196119 confirmed

## Tally
- Flagged rows: 14 (1 IMPRECISE to tighten; 2 UNVERIFIABLE timing to hedge; 11 CORRECT-but-tabled)
- CORRECT (verified): ~30
- WRONG: 0 · OUTDATED: 0 · IMPRECISE: 1 (crypto/rand 1.26 framing) · UNVERIFIABLE: 2 (bcrypt ~250ms timing, cost-12 default timing)
- Content file edited: NO (report-only)
