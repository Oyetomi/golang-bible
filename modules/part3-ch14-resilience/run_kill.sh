#!/bin/sh
# Stop 6: SIGKILL the service in the middle of a load run, five times, and check the books each time.
cd "$(dirname "$0")"
for i in 1 2 3 4 5; do
  psql -q -h 127.0.0.1 -p 55432 -d resil -c "TRUNCATE entries, payments" >/dev/null
  /tmp/payd -addr 127.0.0.1:9001 >/dev/null 2>&1 & P=$!
  sleep 1
  /tmp/load -normal 40 -rps 100 -d 4s >/dev/null 2>&1 &
  sleep 2; kill -9 $P; wait $P 2>/dev/null
  echo "run $i: killed mid-load: $(/tmp/check)"
  wait 2>/dev/null
done
