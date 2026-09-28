#!/bin/sh
# Stop 6: stop ledgerd 1.5 s into a 3 s load with SIGTERM (graceful) and with SIGKILL.
cd "$(dirname "$0")"
PSQL="psql -q -h 127.0.0.1 -p 55432 -d ledgerd"
for sig in TERM KILL; do
  $PSQL -f seed.sql >/dev/null
  /tmp/sinkd >/dev/null 2>&1 & S=$!
  /tmp/ledgerd -quiet >/dev/null 2>&1 & L=$!
  sleep 1
  /tmp/chaos -d 3s -tag $sig > /tmp/chaos.$sig.txt & C=$!
  sleep 1.5; kill -$sig $L; wait $L 2>/dev/null; wait $C
  echo "== SIG$sig at 1.5 s"
  cat /tmp/chaos.$sig.txt | sed 's/ p50.*//'
  $PSQL -Atc "select 'transfers committed in the ledger: '||count(*) from transactions where memo like 'transfer %'"
  kill $S 2>/dev/null; wait $S 2>/dev/null
done
