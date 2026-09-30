#!/usr/bin/env bash
# Tries to run five images in the "prod" namespace, where the webhook is
# enforced. Run ./run.sh first: it leaves the digests in /tmp.
set -uo pipefail
GOOD=$(cat /tmp/supply-good.txt); EVIL=$(cat /tmp/supply-evil.txt); UNSIGNED=$(cat /tmp/supply-unsigned.txt); FORGED=$(cat /tmp/supply-forged.txt)
REG=localhost:5001
try() {
  echo; echo "-- $1: $2"
  kubectl -n prod delete pod "$1" --ignore-not-found --wait=false >/dev/null 2>&1
  kubectl -n prod run "$1" --image="$2" 2>&1 | sed 's/^Error from server (Forbidden): //' | cut -c1-230
}
try by-tag        $REG/ledger-api:1.0
try unsigned      $REG/ledger-api@$UNSIGNED
try replayed      $REG/ledger-api@$EVIL
try forged        $REG/ledger-api@$FORGED
try good          $REG/ledger-api@$GOOD
kubectl -n prod wait --for=condition=Ready pod/good --timeout=60s
echo; echo "-- the webhook's log"; kubectl logs deploy/image-policy | tail -6
