# Accuracy audit — representing-money

Chapter: `content/part-3/01-representing-money.mdx`
Tier 2 (correctness-critical). REPORT ONLY — no content file was edited.

## Audit log

| # | Claim (as written) | Verdict | Source (quoted) | Proposed fix (not applied) |
|---|---|---|---|---|
| 1 | `<Scene>` + `<ExecTimeline>`: "After 5 credits of $0.10, balance is NOT 0.50. It differs by ~5.5e-17." (ExecTimeline final step); intermediate values "+0.10 → 0.3000…0444", "+0.10 → 0.4000…0555". | **WRONG** | Verified by running Go: sequential `total += 0.10` gives after 5 credits **exactly 0.50000000000000000000**, and `total == 0.5` returns **`true`**. The drift errors cancel at the 5th add. Actual intermediates: step 3 = `0.30000000000000004441`, step 4 = `0.40000000000000002220` (not `…0444`/`…0555`). | Use a count where drift is *visible*: at 5 credits it is exactly 0.5; the divergence reappears at 6 (`0.59999999999999997780`) through 10 (`0.99999999999999988898`). Either reframe to "after 10 credits ≠ 1.0" (true) or pick non-cancelling intermediate digits. Do NOT claim "after 5 credits ≠ 0.50" — it is false. |
| 2 | Scene caption: "After 10 credits: float64 balance is 0.9999…998 — a fraction of a cent short of $1.00." | **CORRECT** | Go run: after 10 × `+= 0.10`, `total = 0.99999999999999988898`, `total == 1.0` is `false`. | None. (Digits `…9989`; "…998" is an acceptable truncation.) |
| 3 | "0.1 ≈ 0.1000000000000000055511151231257827021181583404541015625" — the exact stored value of float64 0.1. | **CORRECT** | `python3 Decimal(0.1)` = `0.1000000000000000055511151231257827021181583404541015625` — character-for-character match. | None. |
| 4 | Code/comment: `0.1 + 0.2` prints `0.30000000000000004`, `== 0.3` is `false`. | **CORRECT** | `Decimal(0.1+0.2)` = `0.3000000000000000444…`; `%v` of the float prints `0.30000000000000004`. | None. |
| 5 | IEEE-754 `float64` layout: "1 sign bit, 11 exponent bits, 52 mantissa (significand) bits"; value `(-1)^sign × 1.mantissa × 2^(exponent-1023)`; bias 1023. | **CORRECT** | en.wikipedia.org/wiki/Double-precision_floating-point_format: "Sign bit: 1 bit, Exponent: 11 bits, Significand precision: 53 bits (52 explicitly stored)"; "(-1)^sign × 2^(e-1023) × 1.fraction"; "exponent bias … 1023". | None. |
| 6 | "Only fractions representable exactly are N / 2^k … 5 has no power-of-two factorization, so 1/10 is a repeating binary fraction." | **CORRECT** | Same source + IEEE 754; standard radix-2 result. Confirmed by exact value in row 3. | None. |
| 7 | "Go 1.26 follows IEEE-754-2008 for float64"; "As of Go 1.26, there is no native decimal floating-point type in the language." | **CORRECT (UNVERIFIABLE on exact ed. label, low risk)** | Go spec: float64 is "the set of all IEEE-754 64-bit floating-point numbers"; no decimal type exists in the language. Could not fetch a Go-1.26-specific note pinning the "-2008" edition. | Optional: soften "-2008" to "the IEEE-754 64-bit binary format" unless a Go 1.26 source is cited. Substance correct. |
| 8 | "`int64` holds values from −9,223,372,036,854,775,808 to +9,223,372,036,854,775,807." | **CORRECT** | Computed: int64 max = 9223372036854775807, min = −9223372036854775808. | None. |
| 9 | "In USD cents, that's roughly ±92 trillion dollars." (also Callout: "more than ~$92 trillion") | **WRONG** | int64 max = 9.223e18 cents ÷ 100 = **92,233,720,368,547,758 dollars ≈ 92 *quadrillion* dollars** (~9.2×10^16), not 92 trillion (10^12). Off by ~4 orders of magnitude. | Change "±92 trillion dollars" → "±92 **quadrillion** dollars (~$9.2×10^16)" in both the prose and the `warn` Callout. |
| 10 | Half-even / banker's rounding "Mandated by IEEE-754 as the default rounding mode." | **CORRECT** | en.wikipedia.org/wiki/IEEE_754: "Round to nearest, ties to even is the default for binary floating point." | None. (IEEE 754 specifies it as default for binary; "mandated … as the default" is accurate.) |
| 11 | Half-even examples: "0.5 → 0, 1.5 → 2, 2.5 → 2, 3.5 → 4". | **CORRECT** | Round-half-to-even definition: ties go to nearest even integer. 0.5→0, 1.5→2, 2.5→2, 3.5→4 all hold. | None. |
| 12 | ISO 4217 minor-unit exponents: USD=2, EUR=2, GBP=2, JPY=0, KWD=3, BHD=3. | **CORRECT** | en.wikipedia.org/wiki/ISO_4217 minor-unit ("D") column: USD 2, EUR 2, GBP 2, JPY 0, KWD 3, BHD 3 — all confirmed. | None. |
| 13 | "shopspring/decimal represents a number as a big.Int mantissa plus an integer scale … so 0.1 is stored as 1 × 10^-1 — exactly." | **CORRECT** | pkg.go.dev/github.com/shopspring/decimal: "number = value × 10 ^ exp"; `Coefficient()` returns `*big.Int`, `Exponent()` returns `int32`. | None. |
| 14 | Gotcha: "`decimal.NewFromFloat(0.1)` does NOT give you 0.1 exactly … Use `decimal.NewFromString("0.1")`." | **CORRECT** | shopspring docs: NewFromFloat keeps "significant digits that can be represented in a float with reliable roundtrip"; "float64 … can't represent numbers such as 0.1 exactly"; NewFromString parses exact decimals ("Trailing zeroes are not trimmed"). | None. |
| 15 | "math/big.Rat … stores a fraction as a numerator and denominator big.Int pair, so 1/10 is stored as the pair (1, 10) — also exactly." | **CORRECT** | math/big: `big.Rat` is an arbitrary-precision quotient of two `big.Int` (num/denom) reduced to lowest terms; 1/10 → (1,10). Standard library behavior. | None. |
| 16 | Penny allocation / largest-remainder: "give everyone floor(total/N), then distribute one extra minor unit to each of the first total % N recipients" → all shares sum to total, differ by ≤1. | **CORRECT** | Arithmetic identity: n·floor(t/n) + (t mod n) = t; exactly (t mod n) shares get +1. Verified by the chapter's own runnable example and fuzz invariants. | None. |
| 17 | `Convert` (FX) example: rounds `big.Rat` result by converting to float64 first (`f, _ := converted.Float64(); halfEven(f)`). | **IMPRECISE (pedagogical hazard)** | Not a source-refutable claim, but the chapter elsewhere insists "Never mix decimal-library values with float64." Routing the rounding through `Float64()` reintroduces a binary-rounding step the chapter condemns. The code comment already admits "In production, use shopspring/decimal's RoundBank." | Recommend the Lab's exact-`big.Rat` `halfEven(r *big.Rat)` (already present later in the file) be used in the FX `Convert` example too, to avoid contradicting the chapter's own rule. Substance of the number is fine for the example values; flag as inconsistency, not a hard error. |

### CORRECT (verified, not individually flagged): 12

Rows 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16 verified CORRECT against fetched sources (row 7 correct-with-minor-softening; row 17 imprecise/consistency). Hard errors: rows 1 and 9.

## Sources fetched
- https://en.wikipedia.org/wiki/Double-precision_floating-point_format
- https://en.wikipedia.org/wiki/IEEE_754
- https://en.wikipedia.org/wiki/ISO_4217
- https://pkg.go.dev/github.com/shopspring/decimal
- https://pkg.go.dev/database/sql#TxOptions
- Local Go run (`go run`) + `python3 decimal` to verify float64 accumulation and the exact 0.1 value

## Tally
Flagged: 4 (2 WRONG, 1 UNVERIFIABLE-softening, 1 IMPRECISE) + 13 verified CORRECT. Worst finding: **the ExecTimeline/Scene "after 5 credits of $0.10 ≠ 0.50" is demonstrably false — Go computes exactly 0.50 (errors cancel at step 5); the drift only reappears at credits 6–10.**
