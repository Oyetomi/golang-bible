#!/bin/sh
# Reproduce every number in Part 2 chapter 14. Needs Postgres on 127.0.0.1:55432 with a database named baseline, and network for govulncheck.
cd "$(dirname "$0")"
psql -q -h 127.0.0.1 -p 55432 -d baseline -c "SELECT count(*) FROM users" >/dev/null 2>&1 || { echo "seed the users table first (see README)"; exit 1; }
mkdir -p out
go test -v -count=1 . 2>&1 | grep -v '^===' | grep -v 'TLS handshake error' | tee out/tests.txt
( cd vuln
  for d in reach noreach; do echo "--- $d"; ~/go/bin/govulncheck ./$d 2>&1 | grep -E "^Vulnerability #|Your code|This scan|vulnerabilities in|No vuln|Found in|Fixed in"; done
  cp go.mod go.mod.orig; go get golang.org/x/net@latest >/dev/null 2>&1
  echo "--- after: go get golang.org/x/net@latest"; ~/go/bin/govulncheck ./... 2>&1 | tail -2
  cp go.mod.orig go.mod; rm go.mod.orig; go mod tidy >/dev/null 2>&1
) 2>&1 | tee out/govulncheck.txt
