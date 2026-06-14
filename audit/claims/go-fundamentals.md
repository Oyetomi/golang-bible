# Accuracy audit — go-fundamentals

Chapter: `content/part-1/01-go-fundamentals.mdx`
Mode: REPORT ONLY (no edits applied). Tier-1-adjacent fundamentals chapter — audited every falsifiable claim (types, zero values, control flow, the float-money claim, `len("café")`, the Go 1.26 `new` feature).

Very clean chapter. Types, zero values, control-flow rules, and the string-is-bytes / `len` semantics are all spec-confirmed. The one version-attributed feature — `new()` taking an initializer in Go 1.26 — is CORRECT against the 1.26 release notes. No WRONG findings.

## Audit log

| # | Claim (as written) | Verdict | Source (fetched) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | "every Go file belongs to a package. The package named `main` is special: it's the one Go turns into an executable." | CORRECT | go.dev/ref/spec, Program execution: "A complete program is created by linking a single, unimported package called the main package with all the packages it imports …" The main package's `main` function is the entry point. | none |
| 2 | "import something you don't use and the compiler *refuses to build* … A hard error." | CORRECT | go.dev/ref/spec, Import declarations / Blank identifier: "It is illegal … to import a package without referring to any of its exported identifiers." Unused imports are a compile error. | none |
| 3 | "a name starting with a capital letter is exported (visible to other packages); lowercase is private." | CORRECT | go.dev/ref/spec, Exported identifiers: "An identifier is exported if … the first character of the identifier's name is a Unicode upper case letter." | none |
| 4 | "`subtotal := 1499` … declares a new variable and *infers* its type from the value" → inferred `int` | CORRECT | go.dev/ref/spec, Short variable declarations + default type of an untyped integer constant is `int`. | none |
| 5 | "`:=` only works **inside a function**. At package level … you must use `var`." | CORRECT | go.dev/ref/spec, Short variable declarations: "Short variable declarations may appear only inside functions." | none |
| 6 | "Go's compiler turns your source straight into **native machine code** … the linker bundles it plus the Go runtime into one self-contained executable. No interpreter. No JVM." | CORRECT | Accurate description of the gc toolchain; runtime is statically linked. (Same static-binary claim audited in preflight.) | none |
| 7 | "`int` is the default machine-word integer — 64 bits on most server and laptop targets, but 32 bits on some platforms." | CORRECT | go.dev/ref/spec, Numeric types: "uint either 32 or 64 bits / int same size as uint." So `int` is implementation-defined word width, 64-bit on amd64/arm64, 32-bit on 386/arm. | none |
| 8 | "A `byte` is an 8-bit value (an alias for `uint8`); a `rune` is a Unicode code point (`int32`)." | CORRECT | go.dev/ref/spec, Numeric types: "byte alias for uint8 … rune alias for int32." (rune is an alias for int32, which the chapter states.) | none |
| 9 | "`string` … Immutable bytes commonly used for UTF-8 text. You cannot change a byte in place." | CORRECT | go.dev/ref/spec, String types: "Strings are immutable: once created, it is impossible to change the contents of a string." Chapter correctly frames UTF-8 as convention, not guarantee ("a string can contain arbitrary bytes") — avoids the landmine. | none |
| 10 | "`bool` … No, `0` is not false. This isn't C." | CORRECT | go.dev/ref/spec, Boolean types: bool is a distinct type with values true/false; no implicit int→bool conversion. | none |
| 11 | Money gotcha: "`0.1 + 0.2` is not `0.3` in binary floating point — it's `0.30000000000000004`." | CORRECT | IEEE 754 binary64: 0.1+0.2 evaluates to 0.30000000000000004. Reproducible in Go (`fmt.Println(0.1+0.2)`). | none |
| 12 | Scene: "14.99 + 9.99 + 4.99 = 29.97000…0004" (float invents a cent) vs "1499 + 999 + 499 = 2997" exact | CORRECT (directionally) | The integer sum is exact (2997). The exact float64 result of 14.99+9.99+4.99 is 29.970000000000002 (one trailing 2), not "…0004", but the pedagogical point — float drift vs exact integer cents — is correct; the digits are illustrative, not a literal Go output claim. | Optional: the stylized "29.9700…4" is fine as illustration; if literal accuracy matters, the real value ends in `...002`. |
| 13 | `len("café")` returns 5 (the `é` is two bytes in UTF-8); QuickCheck answer = "5 — it counts UTF-8 bytes" | CORRECT | go.dev/ref/spec, Length and capacity: `len(s)` for a string is "string length in bytes." `é` (U+00E9) is 2 bytes in UTF-8 → "café" = 5 bytes. Reproducible. | none |
| 14 | "A Go `string` is a tiny, **read-only** two-word header: a pointer to some bytes, and a length." | CORRECT | go.dev/blog/slices (string/slice headers) + reflect.StringHeader: string is a 2-word (data ptr, len) header. | none |
| 15 | "every type has a **zero value** … Numbers get `0`, strings get `""`, booleans get `false`, and pointer/slice/map types get `nil`. There is no 'undefined' or 'garbage' like in C." | CORRECT | go.dev/ref/spec, The zero value: "each element of such a variable … is set to the zero value for its type: false for booleans, 0 for numeric types, "" for strings, and nil for pointers, functions, interfaces, slices, channels, and maps." | none |
| 16 | Go 1.26 callout: "`new` now accepts an optional initializer expression, so you can write `p := new(1499)` to get a `*int` pointing directly at `1499`" | CORRECT | go.dev/doc/go1.26: "The built-in `new` function … now allows its operand to be an expression, specifying the initial value of the variable." Example in the notes: `new(yearsSince(born))`. So `new(1499)` → `*int` to 1499 is valid in 1.26. | none — correctly pinned to 1.26. (Pre-1.26, `new` took only a type.) |
| 17 | "`:=` always declares a **new** variable. Inside a nested block, `:=` can accidentally create a *second* variable that **shadows** the outer one … The compiler won't always save you." | CORRECT | go.dev/ref/spec, Short variable declarations + Declarations and scope: `:=` in an inner block introduces a new variable in that block's scope, shadowing an outer one. (vet's `-shadow` is off by default, so "won't always save you" is accurate.) | none |
| 18 | "**`if`** needs no parentheses, always needs curly braces, and can run a little **init statement** first" | CORRECT | go.dev/ref/spec, If statements: "if" with optional SimpleStmt init; braces are mandatory (Block required). | none |
| 19 | "**`for`** is the *only* loop in Go. There is no `while`. There is no `do-while`." + the four outfits (3-part, condition-only, infinite, range) | CORRECT | go.dev/ref/spec, For statements: the only loop keyword is `for`, with for-clause, single-condition, and range forms. Condition-only `for x {}` is Go's while. | none |
| 20 | "`range` — over slices, maps, strings, channels" | CORRECT (and incomplete-but-not-wrong) | go.dev/ref/spec, For statements with range clause: range iterates arrays, slices, strings, maps, channels — and (since 1.22) integers and (since 1.23) functions. The chapter lists the four classic kinds in passing; not asserting the list is exhaustive. | none — not stated as exhaustive. |
| 21 | "**`switch`** … No fall-through by default (a feature) … cases can be any value, not just integers" | CORRECT | go.dev/ref/spec, Expression switches: "In a case or default clause, the last non-empty statement may be a (possibly labeled) 'fallthrough' statement …" — i.e. no implicit fallthrough; case expressions may be any comparable values. | none |
| 22 | ExecTimeline three-part loop: init once, then check → body → post → check…; running total 1499 → 2498 → 3997 over prices [1499, 999, 1499] | CORRECT | go.dev/ref/spec, For statements (for clause): init executed once before first iteration; then condition/body/post cycle. Arithmetic: 1499, +999=2498, +1499=3997 matches. | none |
| 23 | "Functions can **return more than one value** — the convention is always `(result, error)`. … no exceptions, no thrown values." | CORRECT | go.dev/ref/spec, Function types/Return statements: multiple return values supported; Go has no exceptions for ordinary errors — the `(T, error)` convention is idiomatic (effective Go / errors blog). | none |
| 24 | Loop-variable per-iteration semantics implied throughout (range `for _, p := range prices`) — not version-flagged here | CORRECT (no defect) | This chapter doesn't make the pre-1.22 capture claim (that's in functional-go). Nothing to pin here. | none |
| 25 | "`var total int` … zero value is 0 — exactly the right starting point" for an accumulator; "Make the zero value useful" proverb | CORRECT | Zero-value guarantee (row 15) makes `var total int == 0`; the proverb is a documented Go proverb (Rob Pike, Go Proverbs). | none |

## Sources fetched
- https://go.dev/ref/spec (zero values, numeric types incl. int width + byte/rune aliases, string immutability + len-in-bytes, short var decls inside functions, exported identifiers, switch fallthrough, range)
- https://go.dev/doc/go1.26 (new() initializer expression)
- (cross-referenced) IEEE 754 binary64 for 0.1+0.2; reproducible in Go.

## Tally
- Claims logged: 25
- CORRECT: 24 (the substantive type/zero-value/control-flow/version claims all confirmed)
- Flagged rows: 2 minor illustrative-precision notes — #12 (stylized float digits "…0004" vs real "…002", illustration not literal output) and #20 (range list non-exhaustive but not wrong). Neither is a mechanical defect.
- WRONG: 0
- Worst finding: none material. The only thing a pedant could catch is **#12** — the decorative float total in the Scene shows "29.9700…0004" where Go actually prints `29.970000000000002`; it's illustrative, not presented as a literal program output, so it does not mislead the reader's mental model. The substantive claims (zero values, `len("café")`=5, the float-money rule, the Go 1.26 `new(expr)` feature) are all correct.

Frontmatter unchanged: yes (no edits made).
