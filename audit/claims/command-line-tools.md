# Accuracy audit — command-line-tools

Chapter: `content/part-1/12-command-line-tools.mdx` (Tier 3-ish — CLI tooling course chapter. Focus per task: flag, cobra, os.Args, exit codes. Application/framework API claims checked; prose not nitpicked.)
Mode: REPORT ONLY — no edits applied to the chapter.

## Audit log

| # | Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|---|
| 1 | (L967) "Cobra's completion command is registered automatically if you add it: `rootCmd.AddCommand(rootCmd.GenCompletionCmd(true))`". | WRONG | pkg.go.dev/github.com/spf13/cobra: there is **no method named `GenCompletionCmd`** on `cobra.Command`. The completion-script generators are `GenBashCompletionV2`, `GenZshCompletion`, `GenFishCompletion`, `GenPowerShellCompletionWithDesc`, etc. Separately, modern Cobra **auto-registers a `completion` subcommand by default** — you do not call any `GenCompletionCmd`. | Delete the `GenCompletionCmd(true)` line; replace with a note that Cobra adds the `completion` subcommand automatically (disable via `rootCmd.CompletionOptions.DisableDefaultCmd = true`). The hand-rolled `completionCmd` below it (L976+) already uses correct method names and is fine. Recommend an `{/* ACCURACY */}` flag here. |
| 2 | (L588, L591, L605) urfave/cli taught as `github.com/urfave/cli/v2`; Define box (L590) calls it "the other major Go CLI framework" with import path v2; comparison treats v2 as current. | OUTDATED | github.com/urfave/cli: "v3 is the current stable version… latest release v3.9.1 (Jun 10, 2026)… recommended import path is `github.com/urfave/cli/v3`." v2 still compiles but is no longer the recommended path for new projects (v3 has a different API: `cli.Command` root instead of `cli.App`, `cli.Context` replaced). | Add a one-line note that v3 is the current major (`github.com/urfave/cli/v3`) and the v2 example shown is the legacy API; or update the snippet to v3. Not build-breaking, but a "current alternative" framing should name v3. |
| 3 | (L86) "Go's `flag` package, in stdlib since day one, parses command-line arguments from `os.Args`." | CORRECT | `flag` is part of the original Go 1 stdlib; parses `os.Args[1:]`. | None. |
| 4 | (L108, L301-309) `flag.Value` interface = exactly two methods: `String() string` and `Set(string) error`; non-nil `Set` error rejects the value. | CORRECT | stdlib `flag`: `type Value interface { String() string; Set(string) error }`. QuickCheck answer (index 1) is right. | None. |
| 5 | (L101) `flag.Duration` parses Go duration strings (`5s`, `2m30s`, `100ms`) into `time.Duration`. | CORRECT | stdlib `flag.Duration` uses `time.ParseDuration` semantics. | None. |
| 6 | (L235, L270) `flag.NewFlagSet(name, flag.ExitOnError)` → bad flag prints usage and exits; tests use `ContinueOnError` to assert on the error instead of `os.Exit`. | CORRECT | stdlib `flag`: ErrorHandling values ContinueOnError / ExitOnError (calls os.Exit(2)) / PanicOnError. | None. |
| 7 | (L260-261 Callout) "Go's `flag` package stops at the first non-flag argument" — `meridian accounts list acct_001 --json` will not parse `--json`. | CORRECT | stdlib `flag.Parse`: parsing stops just before the first non-flag argument; remaining args go to `Args()`. Documented behavior. | None. |
| 8 | (L229-231, L640) Exit codes: unknown command → `os.Exit(2)`; framework error → `os.Exit(1)`; bad flag via ExitOnError → exit 2. | CORRECT | Conventional; matches stdlib `flag` (exit 2 on parse error) and typical CLI usage-error convention. Application-level choices, internally consistent. | None. |
| 9 | (L558-566 UnderTheHood) Cobra holds per-command local + persistent `*flag.FlagSet`; merges ancestor persistent flagsets before parsing; `MarkFlagRequired` checked after parse via each flag's `Changed` field, before PersistentPreRun/RunE; Args validators run between flag parsing and PersistentPreRun. | CORRECT (light verify) | Matches Cobra's documented execution model (flag parse → ValidateArgs → PersistentPreRun(E) → PreRun(E) → RunE). `Changed` is the real pflag field. Application framework behavior; no confident-wrong mechanism. | None. |
| 10 | (L807, L859, L945 Callout) Bubble Tea = Elm architecture (Model/Update/View); `Cmd` runs in runtime-managed goroutines; Update never concurrent / called from a single goroutine — no model synchronization needed. | CORRECT | Matches Bubble Tea's documented design (returned `tea.Cmd`s run in managed goroutines; Update is serialized). Application framework; no internals defect. | None. |
| 11 | (L662-663 Define) Config precedence flags > env > file > default, "codified by the 12-factor app". | IMPRECISE (minor, prose) | The flags>env>file>default ordering is the standard CLI convention; 12-factor specifically advocates env-var config but does not itself codify this exact 4-tier precedence. Not a falsifiable internals/version claim — out of strict audit scope. | Optional: soften "codified by the 12-factor app" to "consistent with 12-factor's config-via-environment principle." Low priority. |

## Summary

- Rows flagged: 3 (row 1 WRONG — nonexistent `GenCompletionCmd` API; row 2 OUTDATED — urfave/cli v3 is current; row 11 IMPRECISE — minor prose attribution).
- Worst finding: **row 1 — `rootCmd.GenCompletionCmd(true)` is not a real Cobra method.** Confident-wrong API; recommend a `{/* ACCURACY */}` flag and replacement with the auto-registered `completion` subcommand note.
- CORRECT: 8 of 11 audited claims fully correct. Version attributions for Go itself: none made in this chapter (framework-only).
- Money-as-float landmine: AVOIDED (CentsFlag converts to int64 cents via math.Round, never stores the float — correct).

Sources fetched:
- https://pkg.go.dev/github.com/spf13/cobra
- https://github.com/urfave/cli

Frontmatter unchanged: yes (REPORT ONLY — no edits to chapter).
