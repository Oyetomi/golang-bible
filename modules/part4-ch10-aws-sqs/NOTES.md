# Notes: part4-ch10-aws-sqs

Everything ran on LocalStack community 3.8.1, SDK sqs v1.52.1 / aws-sdk-go-v2 v1.47.1.

## Surprises
- Visibility timeout floor: redelivery came 5.17 / 5.94 / 5.96 s after receive for a 5 s timeout (and the DLQ retries at t+2.4, t+5.4 for a 2 s timeout: 2.4 s then 3.0 s gaps). LocalStack's expiry check appears to tick ~1 s. Real AWS timing not measured; do not claim the same jitter.
- DLQ move: the poison got ReceiveCount 1,2,3, then moved on the next expiry; the copy in the DLQ shows ApproximateReceiveCount=4 (count carried over + the DLQ receive). Not verified this is identical on real AWS.
- Local toolchain is go1.24 but go.mod says `go 1.27`; GOTOOLCHAIN=auto downloaded go1.27.0 into the module cache and the programs are built and run with it (so "Go 1.27" is real here). A first attempt to build failed with "no space left on device": the disk was at ~1 GB free and Docker died; the coordinator restarted LocalStack and wiped state; out.txt is from one clean run after that.
- go.mod ended up with `// indirect` removed by `go mod tidy`; `go.sum` is committed-ready. bin/ is deleted after the run (77 MB unstripped); run.sh rebuilds it with -s -w.
- In-flight duplicates: with concurrency >1, the twin of a message can arrive while the first is still processing. My handler returns an error (no delete) so it is redelivered after the visibility timeout; I first wrote it as "skip + delete" which would lose the payment if the first attempt then failed. The idem demo uses concurrency 1 to show the plain skip path; the in-flight branch is coded but not exercised by any measured output.

## Unverified
- Real AWS behaviour for everything above (jitter, DLQ ApproximateReceiveCount, long-poll latency of 18 ms is localhost).
- Whether a ReceiveMessage cancelled client-side during SIGTERM can strand messages in flight on the server until the visibility timeout. In the one run, in-flight was 0 after w1 exited, but one run is not proof; the design tolerates it (message reappears, dedup absorbs it).
- The short-poll count (171) includes a 100 ms sleep in the loop; a tight loop was not measured.
- SQS standard queues only; FIFO queues (MessageDeduplicationId, 5-min dedup window) not tested.
- Step 4b dedup file is not crash-safe (see section); a kill -9 mid-handler was not tested.
- run.sh's `go: ...` version echo goes to the terminal, not out.txt.
- The section.md Step 2 block abbreviates runs 2 and 3 with `(...)`; swap in the full text from out.txt if the chapter wants it.
