#!/bin/sh
# Stop 5: the dual write vs the outbox, with a SIGKILL 1.5 s into a 3 s load.
cd "$(dirname "$0")"
PSQL="psql -q -h 127.0.0.1 -p 55432 -d ledgerd"
state() { curl -s 127.0.0.1:9200/state | python3 -c "import sys,json;d=json.load(sys.stdin);print('sink: received=%d duplicates=%d distinct=%d' % (d['received'],d['duplicates'],d['distinct']))"; }
committed() { $PSQL -Atc "select 'committed transfers in the ledger: '||count(*) from transactions where memo like 'transfer %'"; }
run() {
  mode=$1
  $PSQL -f seed.sql >/dev/null
  /tmp/sinkd >/dev/null 2>&1 & S=$!
  /tmp/ledgerd -quiet -publish $mode >/dev/null 2>&1 & L=$!
  sleep 1
  /tmp/chaos -d 3s -tag $mode >/dev/null & C=$!
  sleep 2; kill -9 $L; wait $L 2>/dev/null; wait $C 2>/dev/null
  sleep 0.5
  echo "== $mode, right after kill -9"
  committed; state
  if [ "$mode" = outbox ]; then
    /tmp/ledgerd -quiet -publish outbox >/dev/null 2>&1 & L=$!
    sleep 3
    echo "== outbox, after restarting ledgerd (the relay drains what was left)"
    committed; state
    $PSQL -Atc "select 'unpublished outbox rows: '||count(*) from outbox where published_at is null"
    kill $L 2>/dev/null; wait $L 2>/dev/null
  fi
  kill $S 2>/dev/null; wait $S 2>/dev/null
}
run naive
run outbox
