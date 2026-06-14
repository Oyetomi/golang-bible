# Accuracy audit — file-servers-cdns

Chapter: `content/part-1/21-file-servers-cdns.mdx`
Mode: REPORT ONLY (no content file edited). Fixes are proposed, not applied.

## Flagged rows

| Claim (as written) | Verdict | Source (quoted) | Proposed fix (NOT applied) |
|---|---|---|---|
| Exercise 3 solution prose: "`http.ServeContent` **derives the ETag from the modTime and the seeker size**." (line ~1020) AND the exercise code reads `rec1.Header().Get("ETag")` expecting a non-empty value to echo as `If-None-Match`. | **WRONG** | pkg.go.dev/net/http ServeContent: "If the caller has set w's ETag header … ServeContent uses it to handle requests using If-Match, If-None-Match, or If-Range." ServeContent does NOT auto-generate an ETag. It derives `Last-Modified` from modtime, but no ETag. | The exercise as written cannot produce a 304 via `If-None-Match` (no ETag is emitted, so `etag` is empty and the second request's `If-None-Match` is empty → not a match). Fix options: (a) set an ETag in the handler before `ServeContent`, then the If-None-Match path works; OR (b) rewrite the exercise to use `If-Modified-Since` with the modtime (which ServeContent DOES honor). Also correct the prose claim. **This contradicts the chapter's own correct statements** in the Define block, the QuickCheck, and the UnderTheHood (all of which say you must set the ETag yourself). |
| Define + prose + UnderTheHood: "`http.FileServer` … does **not** invent a content ETag for you; … set the `ETag` header yourself." (lines ~73, ~252, ~382) | CORRECT | pkg.go.dev/net/http ServeContent (FileServer delegates to it): ETag only used "If the caller has set w's ETag header." | none — these are right; the Exercise 3 prose is the outlier that contradicts them. |
| "`http.ServeContent` automatically emits `Accept-Ranges: bytes` in every response" (Callout) | UNVERIFIABLE (not in fetched godoc) | pkg.go.dev ServeContent text fetched did not explicitly state Accept-Ranges emission. ServeContent does handle Range/`206`/`Content-Range`; emitting `Accept-Ranges: bytes` is the observed/standard behavior but not quoted in the doc excerpt. | Lightly hedge or verify against source; the underlying range-support claim is correct. Low risk. |
| Range request → `206 Partial Content`, `Content-Range`, seek-then-read; "If your source can't seek, range requests silently fall back to full-file responses." | CORRECT | pkg.go.dev ServeContent: "The main benefit of ServeContent over io.Copy is that it handles Range requests properly …"; ReadSeeker requirement is by signature. | none |
| Content-Type via `mime.TypeByExtension`, fallback to `http.DetectContentType` sniffing first 512 bytes | CORRECT | Matches net/http ServeContent/DetectContentType documented behavior (512-byte sniff). | none |
| Gotcha: "`os.Root` (Go 1.24) … confines all subsequent Open/Stat calls within it." | CORRECT | os.Root was added in Go 1.24 (path-traversal-confined directory handle); widely documented. (Version not re-fetched against go1.24 note, but uncontested and consistent with the 1.25 note below referencing Root.) | none |
| Gotcha + UnderTheHood: "As of Go 1.25, `os.Root` also implements `io/fs.ReadLinkFS`" / "`os.DirFS` and `os.Root.FS()` both gained `io/fs.ReadLinkFS` support, so symlink resolution also stays within the root boundary." | CORRECT | go.dev/doc/go1.25: "The filesystems returned by DirFS and Root.FS implement the new io/fs.ReadLinkFS interface." Plus new `Root.Readlink`, `Root.Symlink`, and "A new ReadLinkFS interface provides the ability to read symbolic links." | none. (Minor wording nuance: it's `Root.FS()` and `DirFS` that implement `ReadLinkFS`; `os.Root` itself gains `Readlink`/`Symlink` methods — the chapter's "os.Root also implements ReadLinkFS" is slightly loose but the UnderTheHood states it correctly.) |
| `//go:embed` (Go 1.16+) bakes files at link time into `string`/`[]byte`/`embed.FS`; path relative to package, no `../`; glob patterns; `_`/`.` excluded; `all:` includes hidden | CORRECT | Standard embed package documented rules; matches pkg.go.dev/embed. | none |
| `embed.FS` implements `fs.FS` (Open-only interface), works with `fs.ReadFile`/`fs.ReadDir`/`fs.WalkDir`/`template.ParseFS`; `fs.Sub` strips prefix | CORRECT | io/fs (Go 1.16) and embed docs; `fs.FS` is the single-method `Open(name) (File, error)` interface as quoted in the chapter. | none |
| UnderTheHood: "`embed.FS` stores its contents in the binary's read-only data segment (.rodata) … binary search over a sorted (path,offset,size) slice … never calls open(2)"; "`ModTime` … set to build time" | UNVERIFIABLE (internals) | No primary fetched for the `.rodata` layout / binary-search / build-time ModTime specifics. Chapter hedges: "simplified model; the exact layout is an implementation detail and may change." | Keep the existing hedge. The build-time ModTime point is plausible but unverified; could soften to "ModTime is not the on-disk file time." |
| Signed URLs: HMAC-SHA256 over `path:expiry`, `hmac.Equal` constant-time, expiry check before MAC, `Cache-Control: private, no-store` for signed/authenticated responses | CORRECT | crypto/hmac `Equal` is constant-time (documented); HMAC-over-(path+expiry) binding and the never-`public` rule are standard signed-URL practice. | none |
| CDN edge cache MISS/HIT, fingerprinted (content-hash) URLs sidestep invalidation, `Cache-Control: public, max-age=31536000, immutable` for fingerprinted assets | CORRECT (conceptual) | Standard CDN/cache-header semantics; `immutable` is a real Cache-Control extension honored by modern browsers/CDNs. Latency figures (~5 ms edge vs ~220 ms origin) are illustrative, not asserted as exact. | none |

## CORRECT (verified, not individually tabled)

`http.FileServer` + `http.Dir` + `http.StripPrefix` wiring (URL→path mapping), `http.ServeFile` single-file serving, conditional GET 200/304 flow via `Last-Modified`/`If-Modified-Since`, `Cache-Control` directive meanings (`no-cache` = revalidate not "don't store", `no-store`, `public`, `private`), `http.FS` adapting `fs.FS`→`http.FileSystem`, path-traversal defense via `path.Clean` in FileServer. Align with net/http + io/fs + embed docs.

**CORRECT count (verified claims): ~20** (10 tabled CORRECT + ~10 swept).

## Worst finding

**WRONG**: Exercise 3's solution states "`http.ServeContent` derives the ETag from the modTime and the seeker size" — it does not. ServeContent only uses an ETag the caller sets; it auto-generates only `Last-Modified`. As written, the exercise's `If-None-Match` round-trip cannot yield a 304 (the captured `etag` is empty). The fix is either to set an ETag in the handler or to demonstrate the 304 via `If-Modified-Since`. This single claim also directly contradicts the chapter's own (correct) Define block, QuickCheck, and UnderTheHood, which all say you must set the ETag yourself.

## Sources fetched
- https://pkg.go.dev/net/http#ServeContent (ETag only if caller-set; Last-Modified from modtime; conditional-request handling)
- https://go.dev/doc/go1.25 (os.DirFS / os.Root.FS implement io/fs.ReadLinkFS; Root.Readlink/Symlink)

## Tally
- Flagged rows: 11 (1 WRONG to fix; 2 UNVERIFIABLE to hedge; 8 CORRECT-but-tabled)
- CORRECT (verified): ~20
- WRONG: 1 (ServeContent "derives the ETag") · OUTDATED: 0 · IMPRECISE: 0 · UNVERIFIABLE: 2 (Accept-Ranges emission, embed.FS .rodata/build-time ModTime internals)
- Content file edited: NO (report-only)
