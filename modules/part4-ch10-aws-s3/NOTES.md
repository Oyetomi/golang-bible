# Notes: S3 section

## Surprises and bugs found (all real, all reproduced in out.txt)
1. `feature/s3/manager` (the package every blog post uses) is `Deprecated: superceded by feature/s3/transfermanager`. First version of the multipart program used it and worked; rewritten against `transfermanager` v0.4.12 (a v0 module; API: `tm.UploadObject` / `tm.DownloadObject` with `PartSizeBytes` and `Concurrency`, not `Uploader.PartSize`).
2. `HeadObject` on a missing key returns `*types.NotFound`, not `*types.NoSuchKey` (no response body to parse). `GetObject` returns `NoSuchKey`. Checking only NoSuchKey around HeadObject never matches.
3. Downloading a multipart object logs `WARN Skipped validation of multipart checksum.` to stderr once per part (60 lines for 10 downloads x 6 parts). Cause stated in the section (per-part CRC32 is composite) is my reading of the log text, not verified in the SDK source.
4. LocalStack community 3.8.1 does not enforce presigned-URL signatures or expiry (anonymous GET on a "private" bucket = 200, expired URL = 200, tampered key = ordinary 404). The tamper/expiry failure demo therefore could NOT be shown. Section says so; the 403 behaviour of real S3 is from AWS docs, unverified here. Only the signature-differs-per-key observation is real.
5. `os.Exit` inside `must()` skipped deferred cleanup and left a bucket plus a 25 MB temp file in /tmp; `must` now panics, and `cmd/cleanup` plus a `trap` in run.sh delete every `s3sec-` bucket.
6. One run of the 40 ms-delay multipart failed with `UploadPart ... use of closed network connection` after 3 attempts. It coincided with the host disk filling and Docker Desktop dying (LocalStack was restarted by the coordinator), and did not recur in 4 later runs. I believe it was the outage, not the SDK, but did not prove that.

## Could not verify / caveats
- go.mod says `go 1.24`, not `go 1.27`: the host toolchain is go1.24 and refuses a newer `go` line (GOTOOLCHAIN=local in run.sh). Change the one line to `go 1.27` to match sibling modules; nothing in the code depends on 1.25+. Not built under 1.27.
- Timings are LocalStack on loopback, on a busy machine: single runs vary ~2x. Concurrency 8 vs 1 shows a benefit only with the injected 40 ms/request delay (a simulation, labelled in out.txt): upload median 625 -> 378 ms, download 501 -> 366 ms. On plain loopback upload was 292 -> 213 ms and download not better. Numbers differ on every run.
- Real credential sources IMDS / SSO / web identity were not exercised (only env, shared file, and the "none" failure with IMDS disabled).
- Retry behaviour was tested by injecting 503s through a custom RoundTripper, not by a real throttling service; backoff timing was not measured.
- LocalStack state was wiped once mid-task by a Docker restart; out.txt is from a single complete run after that.
