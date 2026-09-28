#!/bin/sh
# Stop 3: what the payment path does when the fraud service is healthy, slow or down.
cd "$(dirname "$0")"
/tmp/fraudsim -addr 127.0.0.1:9100 >/dev/null 2>&1 & FS=$!
sleep 0.5
run() { # name, fraud-mode-query, payd flags...
  name=$1; mode=$2; shift 2
  curl -s "127.0.0.1:9100/mode?$mode" >/dev/null
  psql -q -h 127.0.0.1 -p 55432 -d resil -c "TRUNCATE entries, payments" >/dev/null
  /tmp/payd -addr 127.0.0.1:9001 -conns 8 -fraud http://127.0.0.1:9100 -fraud-timeout 300ms "$@" >/dev/null 2>&1 & P=$!
  sleep 1
  echo "== $name"
  /tmp/load -normal 40 -rps 20 -bigpct 10 -d 6s
  psql -h 127.0.0.1 -p 55432 -d resil -Atc "select 'stored: ' || status || ' ' || count(*) from payments group by status order by status" | tr '\n' ' '; echo
  kill $P; wait $P 2>/dev/null
}
run "healthy" "delay=0&fail=0" -policy closed
run "slow (2s), fail-closed, no breaker" "delay=2s&fail=0" -policy closed
run "slow (2s), fail-closed, breaker" "delay=2s&fail=0" -policy closed -breaker
run "down (503), fail-closed" "delay=0&fail=1" -policy closed -breaker
run "down (503), fail-open" "delay=0&fail=1" -policy open -breaker
run "down (503), degrade: small allowed, big held" "delay=0&fail=1" -policy degrade -breaker
# the held payments, after the fraud service comes back
curl -s "127.0.0.1:9100/mode?delay=0&fail=0" >/dev/null
echo "== fraud service healed: release the held payments"
/tmp/check
/tmp/check -release http://127.0.0.1:9100
/tmp/check -release http://127.0.0.1:9100
kill $FS
