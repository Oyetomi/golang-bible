#!/bin/sh
# Reproduce every number in chapter 14. Needs Postgres on 127.0.0.1:55432 with a database named resil.
cd "$(dirname "$0")"
go build -o /tmp/payd ./cmd/payd && go build -o /tmp/load ./cmd/load && go build -o /tmp/fraudsim ./cmd/fraudsim && go build -o /tmp/lb ./cmd/lb && go build -o /tmp/check ./cmd/check || exit 1
psql -q -h 127.0.0.1 -p 55432 -d resil -f schema.sql >/dev/null 2>&1
./run_ha.sh        2>&1 | grep -v Killed | tee out/ha.txt
./run_ratelimit.sh 2>&1 | grep -v Killed | tee out/ratelimit.txt
go test -run 'TestLimiterMemory|TestPerAccountIsolation' -v . 2>&1 | grep -v '^===' | tee out/limiter.txt
./run_fraud.sh     2>&1 | grep -v Killed | tee out/fraud.txt
go test -run 'TestIdempotentAndBalanced|TestReconcile' -v . 2>&1 | grep -v '^===' | tee out/ledger.txt
./run_kill.sh      2>&1 | grep -v Killed | tee out/kill.txt
