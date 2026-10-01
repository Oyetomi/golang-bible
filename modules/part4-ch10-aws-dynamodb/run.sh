#!/usr/bin/env bash
# Reproduces every output block in the section into out.txt.
# Needs LocalStack on :4566 with dynamodb enabled. Every table is prefixed
# ddbsec- and deleted by its program on exit.
set -euo pipefail
cd "$(dirname "$0")"
export AWS_ENDPOINT_URL=${AWS_ENDPOINT_URL:-http://127.0.0.1:4566}
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1
{
  echo "# go $(go version | awk '{print $3}')  aws-sdk-go-v2 $(go list -m -f '{{.Version}}' github.com/aws/aws-sdk-go-v2)  service/dynamodb $(go list -m -f '{{.Version}}' github.com/aws/aws-sdk-go-v2/service/dynamodb)  attributevalue $(go list -m -f '{{.Version}}' github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue)  expression $(go list -m -f '{{.Version}}' github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression)"
  echo "# $(curl -s $AWS_ENDPOINT_URL/_localstack/health | python3 -c 'import sys,json;print("localstack",json.load(sys.stdin)["version"])')"
  for p in design debit transfer optimistic query; do
    echo; echo "=== $p ==="
    go run ./cmd/$p
  done
} 2>&1 | tee out.txt
