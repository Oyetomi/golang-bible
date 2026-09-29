#!/bin/sh
# Stop 2: a bot on one account, with no limit, a global limit, and a per-account limit.
cd "$(dirname "$0")"
run() {
  psql -q -h 127.0.0.1 -p 55432 -d resil -c "TRUNCATE entries, payments" >/dev/null
  /tmp/payd -addr 127.0.0.1:9001 -conns 4 "$@" >/dev/null 2>&1 &
  P=$!; sleep 1
  /tmp/load -normal 40 -rps 20 -bot ${BOT:-100} -d 6s
  kill $P; wait $P 2>/dev/null
}
echo "== baseline, no bot"; (BOT=0; run); echo "== bot, no limit"; run
echo "== global limit 200/s burst 50"; run -limit 200 -burst 50 -global
echo "== per-account 30/s burst 5";    run -limit 30 -burst 5
