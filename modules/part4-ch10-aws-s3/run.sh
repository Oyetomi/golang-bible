#!/usr/bin/env bash
# Reproduces every output block of the chapter section. Needs LocalStack on :4566.
set -uo pipefail
trap 'go run ./cmd/cleanup >/dev/null 2>&1' EXIT
cd "$(dirname "$0")"
export GOTOOLCHAIN=${GOTOOLCHAIN:-local}
export AWS_REGION=us-east-1 AWS_EC2_METADATA_DISABLED=true
export AWS_ENDPOINT_URL=http://127.0.0.1:4566
{
echo "### go / sdk versions"
go version
go list -m all | grep -E 'aws-sdk-go-v2(/config|/service/s3|/feature/s3/transfermanager)? |smithy-go'

echo; echo "### 1a. credentials from the environment"
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test go run ./cmd/client

echo; echo "### 1b. no env keys: a shared credentials file (profile 'lab')"
f=$(mktemp); printf '[lab]\naws_access_key_id = fromfile\naws_secret_access_key = test\n' > "$f"
AWS_SHARED_CREDENTIALS_FILE=$f AWS_PROFILE=lab go run ./cmd/client; rm -f "$f"

echo; echo "### 1c. nothing configured (IMDS disabled)"
AWS_SHARED_CREDENTIALS_FILE=/nonexistent AWS_CONFIG_FILE=/nonexistent go run ./cmd/client

export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
echo; echo "### 2a. objects"; go run ./cmd/objects
echo; echo "### 2b. presign"; go run ./cmd/presign
echo; echo "### 3a. multipart, loopback"
go run ./cmd/multipart 2>warn1.txt; echo "stderr: $(wc -l < warn1.txt) lines, distinct messages: $(sed 's/^SDK [0-9/]* [0-9:]* //' warn1.txt | sort | uniq -c | tr -s ' ')"
echo; echo "### 3b. multipart, 40ms injected per request"
go run ./cmd/multipart -rtt 40ms 2>warn2.txt; echo "stderr: $(wc -l < warn2.txt) lines, distinct messages: $(sed 's/^SDK [0-9/]* [0-9:]* //' warn2.txt | sort | uniq -c | tr -s ' ')"
echo; echo "### 4. errors and retries"; go run ./cmd/errs
echo; echo "### cleanup, then leftovers"
go run ./cmd/cleanup; go run ./cmd/client | tail -1
} 2>&1 | tee out.txt
rm -f warn1.txt warn2.txt
