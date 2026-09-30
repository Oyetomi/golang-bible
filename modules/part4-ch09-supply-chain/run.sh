#!/usr/bin/env bash
# The chapter's five experiments, in order. Needs: the registry on
# localhost:5001, the kind cluster with the image-policy webhook installed
# (./deploy.sh), and cosign.key / cosign.pub (cosign generate-key-pair).
set -uo pipefail
cd "$(dirname "$0")"
export COSIGN_PASSWORD=""
REG=localhost:5001
COSIGN=${COSIGN:-cosign}
digest() { sed 's/.*@//'; }
say() { printf '\n== %s\n' "$*"; }

say "1. the same build, twice, and from another directory"
A=$(go run ./cmd/build | digest); B=$(go run ./cmd/build | digest)
rm -rf /tmp/supply-copy && mkdir /tmp/supply-copy && cp -R app cmd verify go.mod go.sum /tmp/supply-copy/
C=$(cd /tmp/supply-copy && go run ./cmd/build | digest)
echo "build 1: $A"; echo "build 2: $B"; echo "other dir: $C"
D=$(go run ./cmd/build -greeting=changed | digest)
echo "one changed input: $D"
GOOD=$A

say "2. a tag can move"
go run ./cmd/build -push $REG/demo:stable >/dev/null
echo "demo:stable -> $(curl -sI -H 'Accept: application/vnd.oci.image.manifest.v1+json' $REG/v2/demo/manifests/stable | tr -d '\r' | awk -F': ' 'tolower($1)=="docker-content-digest"{print $2}')"
go run ./cmd/build -greeting=oops -push $REG/demo:stable >/dev/null
echo "demo:stable -> $(curl -sI -H 'Accept: application/vnd.oci.image.manifest.v1+json' $REG/v2/demo/manifests/stable | tr -d '\r' | awk -F': ' 'tolower($1)=="docker-content-digest"{print $2}')  (same tag, moved)"

say "3. sign, then verify in Go and with cosign"
$COSIGN sign --key cosign.key --tlog-upload=false --yes $REG/ledger-api@$GOOD >/dev/null 2>&1
go run ./cmd/verify $REG/ledger-api@$GOOD
$COSIGN verify --key cosign.pub --insecure-ignore-tlog $REG/ledger-api@$GOOD >/dev/null 2>&1 && echo "cosign verify: OK"

say "4. three images that must not verify"
UNSIGNED=$(go run ./cmd/build -greeting=unsigned | digest)
echo "unsigned:"; go run ./cmd/verify $REG/ledger-api@$UNSIGNED 2>&1 | head -1 | cut -c1-110
EVIL=$(go run ./cmd/build -greeting=evil | digest)
go run ./cmd/replay $REG/ledger-api@$GOOD $REG/ledger-api@$EVIL
echo "replayed signature:"; go run ./cmd/verify $REG/ledger-api@$EVIL 2>&1 | head -1 | cut -c1-200
mkdir -p /tmp/otherkey && [ -f /tmp/otherkey/cosign.key ] || (cd /tmp/otherkey && $COSIGN generate-key-pair >/dev/null 2>&1)
FORGED=$(go run ./cmd/build -greeting=forged | digest)
$COSIGN sign --key /tmp/otherkey/cosign.key --tlog-upload=false --yes $REG/ledger-api@$FORGED >/dev/null 2>&1
echo "signed with someone else's key:"; go run ./cmd/verify $REG/ledger-api@$FORGED 2>&1 | head -1

say "5. an SBOM, attested and verified"
cyclonedx-gomod app -main app -json -output sbom.json -licenses=false . 
$COSIGN attest --key cosign.key --tlog-upload=false --yes --type cyclonedx --predicate sbom.json $REG/ledger-api@$GOOD >/dev/null 2>&1
go run ./cmd/verify -sbom $REG/ledger-api@$GOOD

echo "$GOOD" > /tmp/supply-good.txt; echo "$EVIL" > /tmp/supply-evil.txt; echo "$UNSIGNED" > /tmp/supply-unsigned.txt; echo "$FORGED" > /tmp/supply-forged.txt
