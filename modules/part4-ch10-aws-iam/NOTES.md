# NOTES: part4-ch10-aws-iam

Reproduce: `./run.sh` (needs Go and LocalStack on 127.0.0.1:4566; writes `out.txt`). `section.md` is assembled from the source files and `out.txt`, so line ranges and outputs match what ran.

## Versions
aws-sdk-go-v2 v1.47.1, config v1.33.6, credentials v1.20.6, service/iam v1.64.1, service/sts v1.51.1, service/s3 v1.114.0, go.uber.org/mock v0.6.0 (mockgen run via `go generate`, generated `mock_s3_test.go` is committed in the tree), LocalStack 3.8.1 community.

## go.mod says `go 1.24`, not 1.27
The host toolchain is go1.24.0, which refuses a `go 1.27` directive. Nothing here uses 1.25+ features, but I could not run it on 1.27. Bump the directive when it moves into the book repo.

## Surprises and bugs (all in section.md Step 7)
1. `AWS_ENDPOINT_URL` is not applied to the STS client that `LoadDefaultConfig` builds to resolve a profile's `role_arn` / web identity. Resolver order in config v1.33.6: `resolveCredentials` runs before `resolveBaseEndpoint`. Result: the call goes to real `sts.amazonaws.com` (403 InvalidClientTokenId for the dummy key; unchanged when the endpoint points at a dead port). Fix: `AWS_ENDPOINT_URL_STS`. Side effect during my runs: the dummy key `test` was sent to real AWS STS a handful of times (cases 5a, 5a-proof, and two early debugging runs) and a throwaway unsigned-looking JWT to real STS once during early debugging (before I added the `iat` claim; the error was "Missing a required claim"). No real credentials were involved.
2. Bucket names from `t.Name()` are invalid (commas, spaces, capitals). Seen once in development, fixed in `lab.Name`. That error text in section.md comes from the dev run, not out.txt.
3. IMDS fallback on a laptop stalls several seconds; the exact error text varies between runs ("host is down" vs "context deadline exceeded").
4. With `AWS_ENDPOINT_URL` set the SDK runs with no region at all (case 11). Not verified what real AWS says, only reasoned.
5. Coordinator note: Docker/LocalStack died mid-task and was restarted by the coordinator, wiping state; the final out.txt is one consistent run after that. A stray `credserver` child from my own early test was left on :18080 and made one run's server fail to bind; I killed it (only my own process).

## What LocalStack community does and does not enforce (observed)
Not enforced: identity policies (6 probe requests that the policy forbids all succeeded), Condition keys (SSE requirement ignored), session policy, trust-policy ExternalId (wrong ExternalId was accepted). `SimulatePrincipalPolicy` fails with a 500 wrapping NoSuchEntity for an existing role. Enforced/real: the control-plane objects (create/list/attach/get-back roles and policies, byte-identical policy round trip), AssumeRole returns working-looking temp credentials (LSIA... key IDs, session token), GetCallerIdentity reflects the assumed role, `DurationSeconds` of 5 s is honoured so credential refresh is observable.

## Unverified (reasoned or from docs, not run)
- The "real AWS" column in the enforcement probe: derived from the policy text, not observed against AWS.
- Real AWS minimum `DurationSeconds` of 900 and the session-policy intersection semantics: AWS docs, not tested.
- Real IAM returning policy documents URL-encoded: AWS behaviour from memory/docs; this endpoint returned plain JSON, and the demo handles both.
- LocalStack Pro `ENFORCE_IAM`: not tested.
- Whether LocalStack rejects AssumeRole for a nonexistent role: not tested (an early guess of mine was wrong; the 403 came from real AWS).
- S3 1000-key page size is documented S3 behaviour; observed here as 1000 deleted of 1005.
- The IRSA/ECS/EKS Pod Identity cases use a fake JWT and a 20-line local HTTP server, not a real cluster.
- Timing numbers (1.5 s for the 1,005-key subtest, etc.) are from one machine and vary run to run.
- `-race` was clean on every run, but the tests are `t.Parallel()` over distinct buckets so this says little about the SDK.
