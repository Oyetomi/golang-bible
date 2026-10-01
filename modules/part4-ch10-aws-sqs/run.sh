#!/usr/bin/env bash
# Reproduces every number in section.md into out.txt. Needs LocalStack on :4566
# (sqs). Resources are all named sqssec-* and deleted at the end.
set -uo pipefail
cd "$(dirname "$0")"
export SQS_ENDPOINT=${SQS_ENDPOINT:-http://127.0.0.1:4566}
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1
mkdir -p out bin; rm -f out/worker-*.txt out/idem-*.txt
# go.mod says `go 1.27`; GOTOOLCHAIN=auto fetches that toolchain if needed.
go build -ldflags="-s -w" -o bin/ ./cmd/... || exit 1
echo "go: $(go version)"
{
echo "## Step 1: short vs long polling, 20 s idle each"; ./bin/polling
echo; echo "## Step 2: crash before delete, 3 runs"
for i in 1 2 3; do echo "-- run $i"; ./bin/redeliver; done
echo; echo "## Step 3: poison message, maxReceiveCount=3"; ./bin/dlq
echo; echo "## Step 4a: duplicate delivery"; ./bin/idem
echo; echo "## Step 4b: SIGTERM mid-batch, 40 payments, concurrency 4"
./bin/send cleanup; ./bin/send 40; ./bin/send depth
./bin/worker -name w1 -conc 4 & W=$!
sleep 1.5; kill -TERM $W; wait $W
./bin/send depth
echo "-- restart: worker w2 drains the rest"
./bin/worker -name w2 -conc 4 -for 12s
./bin/send depth
echo "sent=40"
echo "ledger lines=$(wc -l < out/worker-ledger.txt | tr -d ' ') unique payment_ids=$(cut -d' ' -f1 out/worker-ledger.txt | sort -u | wc -l | tr -d ' ')"
echo "ledger total (minor units)=$(awk '{s+=$2} END{print s}' out/worker-ledger.txt) expected=$((100*40*41/2))"
./bin/send cleanup
} 2>&1 | tee out.txt
