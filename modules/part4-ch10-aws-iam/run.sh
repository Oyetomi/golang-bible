#!/usr/bin/env bash
# Reproduces every number in section.md into out.txt.
# Needs: Go (1.24+), LocalStack on 127.0.0.1:4566. Creates only iamsec-* resources and deletes them.
set -u
cd "$(dirname "$0")"
OUT=out.txt
: > "$OUT"
exec > >(tee -a "$OUT") 2>&1

EP=${AWS_ENDPOINT_URL:-http://127.0.0.1:4566}
export AWS_ENDPOINT_URL=$EP AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

hdr() { printf '\n##### %s\n' "$*"; }

hdr "versions"
go version
go list -m github.com/aws/aws-sdk-go-v2 github.com/aws/aws-sdk-go-v2/config github.com/aws/aws-sdk-go-v2/credentials github.com/aws/aws-sdk-go-v2/service/iam github.com/aws/aws-sdk-go-v2/service/sts github.com/aws/aws-sdk-go-v2/service/s3 go.uber.org/mock
curl -s "$EP/_localstack/health" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("localstack", d.get("version"), {k:v for k,v in d["services"].items() if v!="disabled"})'

BIN=$(mktemp -d)
trap 'rm -rf "$BIN"; kill $CS 2>/dev/null' EXIT
go build -o "$BIN" ./cmd/... || exit 1

hdr "step 1: STS GetCallerIdentity, role with trust policy, AssumeRole with session policy"
"$BIN/whoami"

hdr "step 2: stscreds.AssumeRoleProvider + CredentialsCache renewing every ~3s"
"$BIN/refresh"

hdr "step 3: the default credential chain, one source at a time"
W=$(mktemp -d)
cat > "$W/credentials" <<'EOF'
[default]
aws_access_key_id = AKIAPROFILEDEFAULT0
aws_secret_access_key = test

[reader]
aws_access_key_id = AKIAPROFILEREADER00
aws_secret_access_key = test

[admin]
aws_access_key_id = test
aws_secret_access_key = test
EOF
python3 - "$W/token" <<'EOF'
import base64,json,sys,time
b=lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
open(sys.argv[1],"w").write(b({"alg":"none"})+"."+b({"iss":"https://oidc.local.example","sub":"system:serviceaccount:default:demo","aud":"sts.amazonaws.com","iat":int(time.time()),"exp":int(time.time())+3600})+".")
EOF
"$BIN/credserver" 127.0.0.1:18080 & CS=$!
sleep 1
"$BIN/rolectl" create iamsec-chain-role
# every case starts from an empty environment so nothing leaks in from this shell
chain() { # label, then VAR=value pairs
  local label=$1; shift
  printf '\n[%s]\n  env: %s\n' "$label" "$*" | sed "s#$W#\$W#g"
  env -i PATH="$PATH" HOME="$W" AWS_ENDPOINT_URL="$EP" "$@" "$BIN/chain" | sed "s#$W#\$W#g; s/^/  /"
}
NOFILES="AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_CONFIG_FILE=/dev/null"
FILES="AWS_SHARED_CREDENTIALS_FILE=$W/credentials AWS_CONFIG_FILE=/dev/null"
NOIMDS="AWS_EC2_METADATA_DISABLED=true"
R="AWS_REGION=us-east-1"

chain "1 environment variables" $R $NOFILES $NOIMDS AWS_ACCESS_KEY_ID=AKIAFROMENVIRONMENT AWS_SECRET_ACCESS_KEY=test
chain "2 env AND profile present: env wins, AWS_PROFILE ignored" $R $FILES $NOIMDS AWS_PROFILE=reader AWS_ACCESS_KEY_ID=AKIAFROMENVIRONMENT AWS_SECRET_ACCESS_KEY=test
chain "3 shared credentials file, [default] profile" $R $FILES $NOIMDS
chain "4 shared credentials file, AWS_PROFILE=reader" $R $FILES $NOIMDS AWS_PROFILE=reader
cat > "$W/config" <<'EOF'
[profile deployer]
role_arn = arn:aws:iam::000000000000:role/iamsec-chain-role
source_profile = admin
role_session_name = chain-demo
EOF
chain "5a profile with role_arn + source_profile (assume role), AWS_ENDPOINT_URL only" $R AWS_SHARED_CREDENTIALS_FILE="$W/credentials" AWS_CONFIG_FILE="$W/config" $NOIMDS AWS_PROFILE=deployer
chain "5a-proof the same profile, AWS_ENDPOINT_URL pointed at a dead port: the answer is unchanged, so something else answered" $R AWS_SHARED_CREDENTIALS_FILE="$W/credentials" AWS_CONFIG_FILE="$W/config" $NOIMDS AWS_PROFILE=deployer AWS_ENDPOINT_URL=http://127.0.0.1:9
chain "5b same, plus AWS_ENDPOINT_URL_STS" $R AWS_SHARED_CREDENTIALS_FILE="$W/credentials" AWS_CONFIG_FILE="$W/config" $NOIMDS AWS_PROFILE=deployer AWS_ENDPOINT_URL_STS="$EP"
chain "6 web identity (what EKS IRSA injects)" $R $NOFILES $NOIMDS AWS_ENDPOINT_URL_STS="$EP" AWS_WEB_IDENTITY_TOKEN_FILE="$W/token" AWS_ROLE_ARN=arn:aws:iam::000000000000:role/iamsec-chain-role
chain "7 container credentials (ECS task role / EKS Pod Identity)" $R $NOFILES $NOIMDS AWS_CONTAINER_CREDENTIALS_FULL_URI=http://127.0.0.1:18080/creds AWS_CONTAINER_AUTHORIZATION_TOKEN=chapter-token
chain "8 container creds AND a profile file: the profile wins" $R $FILES $NOIMDS AWS_CONTAINER_CREDENTIALS_FULL_URI=http://127.0.0.1:18080/creds AWS_CONTAINER_AUTHORIZATION_TOKEN=chapter-token
chain "9 nothing configured, IMDS disabled" $R $NOFILES $NOIMDS
printf '\n[10 nothing configured, IMDS left on (a laptop with no cloud around it)]\n'
S=$(date +%s)
env -i PATH="$PATH" HOME="$W" AWS_ENDPOINT_URL="$EP" $R $NOFILES "$BIN/chain" | sed 's/^/  /'
echo "  took: $(( $(date +%s) - S ))s (chain binary caps itself at 8s)"
printf '\n[11 no region anywhere]\n'
env -i PATH="$PATH" HOME="$W" AWS_ENDPOINT_URL="$EP" $NOFILES $NOIMDS AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test "$BIN/chain" | sed 's/^/  /'

"$BIN/rolectl" delete iamsec-chain-role

hdr "step 4: policy as code: build, lint, create, attach, and what this endpoint enforces"
"$BIN/policydemo"

hdr "step 5a: unit tests for the linter"
go test -race -count=1 -v ./internal/policy 2>&1 | grep -E '^(---|    ---|ok|FAIL|PASS)'

hdr "step 5b: S3 tests with NO endpoint configured (skip, and REQUIRE_AWS=1 turns the skip into a failure)"
env -u AWS_ENDPOINT_URL go test -count=1 -v -run LocalStack ./internal/purge 2>&1 | grep -E '^(---|ok|FAIL|PASS|\s+labtest|\s+purge)|SKIP|skip' 
env -u AWS_ENDPOINT_URL REQUIRE_AWS=1 go test -count=1 -run LocalStack ./internal/purge 2>&1 | grep -E 'REQUIRE_AWS|^(ok|FAIL)'

hdr "step 5c: first-draft Prefix (single page), go test -race -tags buggy"
REQUIRE_AWS=1 go test -race -count=1 -tags buggy -v ./internal/purge 2>&1 | grep -v -E '^(=== (RUN|PAUSE|CONT|NAME))' | sed -E 's#/Users/[^ ]*/(internal/purge/)#\1#; s#(HostID|RequestID): [^ ,]*#\1: <id>#'

hdr "step 5d: fixed Prefix, go test -race"
REQUIRE_AWS=1 go test -race -count=1 -v ./internal/purge 2>&1 | grep -v -E '^(=== (RUN|PAUSE|CONT|NAME))'

hdr "leak check: iamsec- resources still on the endpoint (expect none)"
go run ./cmd/leakcheck
