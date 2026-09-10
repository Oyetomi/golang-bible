# Snippet fixture module

Pinned dependency set for Go snippets in `content/` that import third-party
packages. `scripts/test-snippets.mjs --with-modules` copies `go.mod` and
`go.sum` into its scratch directory so those snippets build against fixed
versions instead of whatever the proxy serves that day.

`go.mod` declares the same Go release as `GO_VERSION` in `test-snippets.mjs`,
and CI pins every snippet job to it. Keep all three in step.

A dependency can drag the directive past the pinned release. `github.com/enetx/surf`
did exactly that: it required 1.27 while the corpus targeted 1.26, so it was
dropped and its one snippet marked `noverify`. When the corpus moved to 1.27 it
came back and that snippet is verified again. When `go get` bumps the `go` line,
either raise the pinned version everywhere or drop the dependency — never let the
fixture and the content target drift apart silently.

## Adding a dependency

When a new chapter imports a package that is not yet here:

```sh
cd scripts/snippet-fixtures
go get <package>
```

Commit the resulting `go.mod` and `go.sum`. Do not run `go mod tidy` — this
module has no source files of its own, so tidy drops every requirement.
