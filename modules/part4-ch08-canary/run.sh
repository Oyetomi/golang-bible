#!/usr/bin/env bash
# The three releases of chapter 8, each under the same load: 100 requests a
# second through the Service, from a pod inside the cluster.
#   ./run.sh rolling   a plain rolling update to the bad build
#   ./run.sh bad       the canary controller, bad build (5% of requests fail)
#   ./run.sh good      the canary controller, good build
set -euo pipefail
cd "$(dirname "$0")"

reset() {
  kubectl delete pod load --ignore-not-found >/dev/null
  kubectl apply -f deploy/ledger.yaml >/dev/null
  kubectl set env deploy/ledger-stable VERSION=v1 BUG_RATE=0 >/dev/null
  kubectl scale deploy/ledger-stable --replicas=20 >/dev/null
  kubectl scale deploy/ledger-canary --replicas=0 >/dev/null
  kubectl rollout status deploy/ledger-stable --timeout=180s >/dev/null
  sleep 5
}
load() { kubectl run load --image=ledger-api:v1 --restart=Never --command -- /load -url http://ledger/transfer -rate 100 -for "$1" >/dev/null; sleep 8; }
result() { until kubectl logs load 2>/dev/null | grep -q '^total'; do sleep 2; done; kubectl logs load | grep '^total'; }

reset
case "$1" in
  rolling)
    load 75s
    kubectl set env deploy/ledger-stable VERSION=v2 BUG_RATE=0.05 >/dev/null
    kubectl rollout status deploy/ledger-stable --timeout=120s >/dev/null
    echo "rolled out; nobody is watching, so it stays"
    result ;;
  bad)
    kubectl set env deploy/ledger-canary BUG_RATE=0.05 >/dev/null
    load 75s
    go run ./cmd/canary || true
    result ;;
  good)
    kubectl set env deploy/ledger-canary BUG_RATE=0 >/dev/null
    load 130s
    go run ./cmd/canary
    result ;;
esac
