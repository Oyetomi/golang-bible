#!/usr/bin/env bash
# Builds and pushes the webhook image, makes its certificates, and installs
# the policy. Run after the kind cluster and registry from the chapter exist.
set -euo pipefail
cd "$(dirname "$0")"
go run ./cmd/build -pkg ./cmd/webhook -entry webhook -push localhost:5001/webhook:1.0
go run ./cmd/certs
kubectl create secret generic image-policy-tls --from-file=tls.crt --from-file=tls.key --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl create configmap image-policy-key --from-file=cosign.pub --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl apply -f deploy/policy.yaml >/dev/null
kubectl rollout status deploy/image-policy --timeout=120s
sed "s|@@CABUNDLE@@|$(base64 < ca.crt | tr -d '\n')|" deploy/webhook-config.yaml.tmpl | kubectl apply -f - >/dev/null
echo "policy installed"
