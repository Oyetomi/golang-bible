# Notes: DynamoDB section

Versions: aws-sdk-go-v2 v1.47.1, service/dynamodb v1.70.0, feature/dynamodb/attributevalue v1.21.8, expression v1.9.8, LocalStack 3.8.1, Go 1.24.0 (host).

## Surprises
- LocalStack/Docker died mid-run (BatchWriteItem returned 500 InternalFailure, then :4566 refused). Coordinator restarted it; out.txt is from ONE complete run.sh after the restart.
- Naive read-then-write numbers vary between runs (balance fell by 10 or 20 of a demanded 500). The conditional numbers (30 ok / 20 rejected / 0) were identical in every run. Prose should not hard-code the naive figures beyond "out.txt".
- IdempotentParameterMismatchException has an empty Message on LocalStack; real AWS probably fills it.
- Empty 13th page when 1,200 entries are paged at Limit=100: expected DynamoDB behaviour, but worth the sentence.
- `omitempty` on balance really removes a zero balance, and a later `balance >= 0` condition fails on it.
- go.mod says `go 1.24`, not 1.27: host go1.24 cannot build 1.27 modules offline. Change the line (and run go mod tidy) when integrating. Dependencies in go.mod are tidy.

## Not verified / LocalStack differs from AWS
- No throttling, hot-partition limits, adaptive capacity, or 1 MB-page behaviour at scale (1,200 entries fit in one page, ~150 B each; Scan of 5,970 items also returned one page).
- ConsumedCapacity values (0.5/15.5/18.0/80.0 RCU) are LocalStack's accounting; they look like real eventual-consistency math (0.5 RCU per 4 KB) but I did not compare with AWS. Wall times are laptop-to-container, not DynamoDB latency.
- Transaction isolation, ClientRequestToken 10-minute expiry, the 100-item transaction limit, and TransactionConflictException under real contention were not tested. LocalStack serialises requests, so the concurrency results demonstrate the logic, not DynamoDB's real contention behaviour. In real DynamoDB, 50 hot-key conditional writes would also see throttling and the SDK's retries.
- Optimistic locking retries (~100 for 20 writers) depend on LocalStack's timing.
- Billing: on-demand mode is accepted, cost not modelled.
- Table cleanup: each program deletes its ddbsec-* table on exit; ListTables was empty afterwards.
