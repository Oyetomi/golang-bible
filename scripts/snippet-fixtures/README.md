# Snippet fixture module

Pinned dependency set for Go snippets in `content/` that import third-party
packages. `scripts/test-snippets.mjs --with-modules` copies `go.mod` and
`go.sum` into its scratch directory so those snippets build against fixed
versions instead of whatever the proxy serves that day.

`go.mod` declares the same Go release as `GO_VERSION` in `test-snippets.mjs`,
and CI pins every snippet job to it. Keep all three in step.

A dependency can drag the directive past that release — `github.com/enetx/surf`
once forced 1.27. When `go get` bumps the `go` line, either raise the pinned
version everywhere or drop the dependency and mark the snippets that import it
`noverify`.

## Adding a dependency

When a new chapter imports a package that is not yet here:

```sh
cd scripts/snippet-fixtures
go get <package>
```

Commit the resulting `go.mod` and `go.sum`. Do not run `go mod tidy` — this
module has no source files of its own, so tidy drops every requirement.
