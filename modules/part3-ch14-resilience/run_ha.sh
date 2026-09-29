#!/bin/sh
# Stop 1: two payd instances behind a balancer; kill one three seconds into an 8 second run.
cd "$(dirname "$0")"
run() {
  name=$1; shift
  psql -q -h 127.0.0.1 -p 55432 -d resil -c "TRUNCATE entries, payments" >/dev/null
  /tmp/payd -addr 127.0.0.1:9001 >/dev/null 2>&1 & A=$!
  /tmp/payd -addr 127.0.0.1:9002 >/dev/null 2>&1 & B=$!
  /tmp/lb -addr 127.0.0.1:9000 "$@" >/dev/null 2>&1 & L=$!
  sleep 1
  ( sleep 3; kill -9 $A ) &
  echo "== $name"
  /tmp/load -url http://127.0.0.1:9000 -normal 40 -rps 20 -d 8s
  psql -h 127.0.0.1 -p 55432 -d resil -Atc "select 'payments stored: '||count(*) from payments"
  kill $B $L 2>/dev/null; wait 2>/dev/null
}
run "no health check, no retry"
run "health check only" -health
run "health check + retry" -health -retry
run "retry only" -retry
