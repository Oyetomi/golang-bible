# Accuracy audit — grpc-service-communication

Chapter: `content/part-2/18-grpc-service-communication.mdx`
Scope: HTTP/2, protobuf wire format, the four streaming modes, interceptors, deadlines/metadata, status codes, schema evolution, Go-version/module attributions. REPORT ONLY — no content file edited.

## Flagged / touched rows

| Claim (as written) | Verdict | Source (quoted) | Proposed action (NOT applied) |
|---|---|---|---|
| **UnderTheHood, line 299:** "The full encoding for `Money{4999, \"USD\"}` is: `08 c7 27 12 03 55 53 44` — eight bytes." (and line 297: "The value `4999` follows as a varint … 2 bytes") | **WRONG** | protobuf.dev/programming-guides/encoding: varint payload is "the 7-bit payloads of its constituent bytes." Decoding `c7 27`: `(0x47) | (0x27<<7)` = 71 + 4992 = **5063**, NOT 4999. The varint for **4999** is `87 27`. So the byte string encodes `Money{5063,"USD"}`, not 4999. | Fix the value bytes: `Money{4999,"USD"}` → `08 87 27 12 03 55 53 44`. **OR** change the struct value in this section to 5063 to match `c7 27`. NOTE this *directly contradicts* Exercise 1 (line 1143), which correctly states `[]byte{0xC7,0x27}` decodes to **5063**. The chapter is internally inconsistent; the UnderTheHood section is the wrong one. |
| Tag for `amount_minor_units = 1`, varint type: "`(1 << 3) | 0 = 0x08`" (line 297) | CORRECT | protobuf.dev: tag = "`(field_number << 3) | wire_type`"; field 1, wire type 0 → `0x08`. | Leave. |
| Wire types: "`0` = varint, `2` = length-delimited"; currency_code tag "`0x12`" length-prefixed UTF-8 (lines 296–297) | CORRECT | protobuf.dev: "VARINT=0 … LEN=2"; field 2 LEN tag = (2<<3)\|2 = 0x12; "Strings are LEN-encoded." | Leave. |
| Varint exercise: "`decodeVarint([]byte{0xC7, 0x27})` should return `(5063, 2)`" and the worked comment "value = 71 \| (39 << 7) = 71 + 4992 = 5063" (lines 1143, 1171) | CORRECT | Same encoding rule; verified by computation: 5063. | Leave. (This is the *correct* half of the contradiction above.) |
| "Unknown fields are preserved by default (as of proto3 since the 3.5.x runtime)" (line 303); rule #3 "proto3 since runtime 3.5.x preserves them" (line 1067) | UNVERIFIABLE (claim true in spirit; version detail unsourced) | protobuf.dev/programming-guides/proto3: "Proto3 messages preserve unknown fields…which matches proto2 behavior." The current spec gives **no** mention of "3.5" or the historical drop/re-add. (Historically accurate — preservation was restored in protobuf 3.5, 2017 — but not confirmable from the fetched primary source.) | Keep the behavior claim (preservation is correct); soften the "3.5.x runtime" pin to "in modern proto3 runtimes" unless a primary cite is added. Low severity. |
| Field numbers on the wire, names are not; rename safe, never reuse/retype a number (lines 106, 216, 301, 1065–1067) | CORRECT | protobuf.dev encoding: tag is "(field_number << 3) | wire_type" — only the number travels; "you can rename fields freely but must never reuse or change a field number." | Leave. |
| "As of Go 1.26, the `google.golang.org/protobuf` module (v2 API) is the standard. The older `github.com/golang/protobuf` module (v1) is a wrapper shim" (line 305) | CORRECT | go.dev/blog/protobuf-apiv2: "The google.golang.org/protobuf module is APIv2." "github.com/golang/protobuf@v1.4.0 is a version of APIv1 implemented in terms of APIv2." | Leave. (Go 1.26 pin is harmless — relationship is stable.) |
| Four RPC types: unary; server-streaming (1 req, many resp); client-streaming (many req, 1 resp); bidirectional (both stream concurrently) (lines 118, 320–324) | CORRECT | grpc.io core-concepts: unary "single request…single response"; server streaming "stream to read a sequence of messages back"; client streaming "writes a sequence of messages"; bidi "both sides send a sequence of messages using a read-write stream. The two streams operate independently." | Leave. |
| Deadline travels over the wire as the `grpc-timeout` header; downstream gets the *remaining* budget; e.g. `grpc-timeout: 3000000u` microseconds (lines 122, 835, 922) | CORRECT | grpc/PROTOCOL-HTTP2.md: "Timeout → 'grpc-timeout' TimeoutValue TimeoutUnit"; units include Microsecond (u); example "3000000u". grpc.io: deadline terminates with DEADLINE_EXCEEDED. | Leave. |
| gRPC unary request: HEADERS with `:method: POST`, `:path: /ledger.v1.AccountService/GetAccount`, `content-type: application/grpc`; DATA = 5-byte prefix (1 byte compression flag + 4-byte length) + proto; response trailer `grpc-status: 0` = OK (lines 922–926) | CORRECT | grpc/PROTOCOL-HTTP2.md: ":method POST"; ":path" "/" Service-Name "/" method; "content-type 'application/grpc'"; "Length-Prefixed-Message → Compressed-Flag Message-Length Message" (1-byte flag, 4-byte big-endian length); "Status → 'grpc-status' …" with 0 = OK. | Leave. |
| Metadata carries auth as key-value pairs; interceptor reads `authorization` from metadata (lines 462–466, 534) | CORRECT | grpc.io: "Metadata is information about a particular RPC call…in the form of a list of key-value pairs, where the keys are strings." | Leave. |
| "`grpc.NewClient` is the current entry point; `grpc.Dial` and `grpc.DialContext` are deprecated but still documented as supported throughout grpc-go 1.x" (lines 897, 932) | CORRECT | pkg.go.dev/google.golang.org/grpc: Dial "Deprecated: use NewClient instead. Will be supported throughout 1.x."; DialContext same. | Leave. |
| `grpc.ChainUnaryInterceptor` (server) runs in declaration order, first = outermost; client uses `grpc.WithChainUnaryInterceptor` as a DialOption (lines 114, 500, 558, 560) | CORRECT | pkg.go.dev/google.golang.org/grpc: ChainUnaryInterceptor = ServerOption; WithChainUnaryInterceptor = DialOption, "The first interceptor will be the outer most." | Leave. |
| gRPC status codes: NOT_FOUND=5, ALREADY_EXISTS=6, INVALID_ARGUMENT=3, PERMISSION_DENIED=7, UNAUTHENTICATED=16, RESOURCE_EXHAUSTED=8, UNAVAILABLE=14, DEADLINE_EXCEEDED=4, INTERNAL=13, UNIMPLEMENTED=12, FAILED_PRECONDITION=9, OK=0 (lines 569–580, 636–646, 1533–1539) | CORRECT | Standard gRPC code numbering (grpc/codes). Matches the canonical `google.golang.org/grpc/codes` integer values. | Leave. |
| HTTP/2 multiplexes concurrent RPCs over one TCP connection; one stream per RPC; flow control per-stream/per-connection; HOL blocking of HTTP/1.1 is removed (lines 915, 919–930) | CORRECT | grpc/PROTOCOL-HTTP2.md models each RPC onto an HTTP/2 stream; HTTP/2 (RFC 7540) provides multiplexing and flow control. (grpc.io page did not state HTTP/2 explicitly, but the protocol doc and HTTP/2 spec confirm.) | Leave. |
| "browsers can't speak gRPC natively (no access to raw HTTP/2 trailers)… gRPC requires a gateway or gRPC-Web" (lines 982, 1040) | CORRECT | Well-established gRPC-Web rationale; consistent with the HTTP/2 protocol doc's reliance on trailers for grpc-status. | Leave. |
| "rename a field… the JSON encoding (via protojson) uses the field name, so renaming does break JSON consumers" (line 313) | CORRECT | protobuf JSON mapping keys on field name (json_name); binary keys on number. Consistent with encoding guide. | Leave. |

## CORRECT (verified, left silently): summary count

Verified-correct, load-bearing claims: **15+** (tag formula, wire types, four RPC shapes, grpc-timeout header+units, HEADERS/DATA framing, length-prefix, grpc-status, metadata, NewClient/Dial deprecation, interceptor chaining, status-code numbers, protobuf v1/v2 modules, field-number permanence, message ordering).

## Sources fetched (URLs actually opened)

- https://protobuf.dev/programming-guides/encoding/
- https://protobuf.dev/programming-guides/proto3/
- https://protobuf.dev/reference/go/
- https://go.dev/blog/protobuf-apiv2
- https://grpc.io/docs/what-is-grpc/core-concepts/
- https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md
- https://pkg.go.dev/google.golang.org/grpc

## Tally

- WRONG: 1 — the `Money{4999,"USD"}` byte string `08 c7 27 …` (c7 27 decodes to 5063, not 4999; varint for 4999 is `87 27`). Self-contradicted by Exercise 1.
- OUTDATED: 0
- IMPRECISE: 0
- UNVERIFIABLE (downgrade recommended): 1 — the "proto3 since the 3.5.x runtime" version pin on unknown-field preservation (behavior correct; version not in fetched source).
- CORRECT (confirmed): 15+ load-bearing claims

**Worst finding:** WRONG — UnderTheHood (line 299) states `Money{4999,"USD"}` encodes to `08 c7 27 12 03 55 53 44`, but `c7 27` is the varint for **5063**; 4999 encodes to `87 27`. The exact bytes are load-bearing (this is a "see the wire format" walkthrough) and the chapter contradicts itself — Exercise 1 (line 1143) correctly decodes `0xC7,0x27` to 5063. Proposed fix: change the value bytes to `08 87 27 12 03 55 53 44`, or change the example value to 5063.

Flag suggested for human review (since the *intended* value is ambiguous — fix the bytes vs. fix the number): `{/* ACCURACY: Money{4999,"USD"} encodes 08 87 27 ... — "c7 27" is the varint for 5063, contradicting Exercise 1 — needs human check */}` near line 299.

Frontmatter unchanged: yes (report-only; no content file touched).
