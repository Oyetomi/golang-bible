#!/bin/sh
# Reproduce every number in chapter 13. Needs Postgres on 127.0.0.1:55432.
set -e
cd "$(dirname "$0")"
psql -q -h 127.0.0.1 -p 55432 -d acl -f schema.sql >/dev/null 2>&1
psql -q -h 127.0.0.1 -p 55432 -d acl -f rls.sql >/dev/null 2>&1
go run ./cmd/enum -v v0 | tee out/enum.txt
go run ./cmd/enum -v v1 | tee -a out/enum.txt
go run ./cmd/rls | tee out/rls.txt
go test -count=1 -run 'TestListSizes|TestBodyTenant|TestOracle|TestPeerIDOR|TestGrant|TestDefaultDeny|TestSecondDoor|TestMatrix|TestErrorSplit|TestApplyThenCheck|TestRuleChangeWindow' -v . 2>&1 | grep -v '^===' | tee out/tests.txt
