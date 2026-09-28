#!/bin/sh
# Reproduce every number in chapter 15. Needs Postgres on 127.0.0.1:55432 with a database named ledgerd.
cd "$(dirname "$0")"
psql -q -h 127.0.0.1 -p 55432 -d ledgerd -f migrations/001_init.sql >/dev/null 2>&1
go build -o /tmp/ledgerd ./cmd/ledgerd && go build -o /tmp/sinkd ./cmd/sink && go build -o /tmp/chaos ./cmd/chaos || exit 1
go test ./internal/domain/ -run 'TestAdd|TestAllocate|TestTransactionValidate' -v 2>&1 | grep -v '^===' | tee out/domain.txt
go test -fuzz=FuzzAllocate -fuzztime=10s ./internal/domain/ 2>&1 | tail -4 | tee out/fuzz.txt
go test -fuzz=FuzzAddNegate -fuzztime=5s ./internal/domain/ 2>&1 | tail -3 | tee -a out/fuzz.txt
go test -race ./internal/store/ -v -timeout 300s 2>&1 | grep -v '^===' | tee out/store.txt
go test ./internal/api/ ./internal/outbox/ -v 2>&1 | grep -v '^===' | grep -v -- '--- PASS.*/' | tee out/api.txt
./run_events.sh   2>&1 | grep -v Killed | tee out/events.txt
./run_shutdown.sh 2>&1 | grep -v Killed | tee out/shutdown.txt
