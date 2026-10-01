#!/usr/bin/env python3
"""Tally what Go job listings ask for, and where the book covers it.

Input: a JSON list of listings, each {id, title, company, location, description}
(the shape glassdoor-mcp's search_jobs / job_details produce). Listings that are
not Go roles (no "go"/"golang" in the title or description) are dropped.

    python3 scripts/job-skills/tally.py listings.json [--cap 3]

--cap limits how many listings one company may contribute, because one
recruiter posting 30 near-identical ads would otherwise decide the ranking.
Descriptions are optional: with titles only, only title keywords can match, and
the report says so.
"""
import argparse, collections, glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "content")

# skill -> (regex, [chapter file globs relative to content/])
SKILLS = {
    "Kubernetes":          (r"\bk8s\b|kubernetes",                      ["part-4/05-*", "part-1/27-*", "appendix/43-*"]),
    "Docker / containers": (r"\bdocker\b|container",                    ["part-4/01-*", "part-1/25-*"]),
    "Terraform / IaC":     (r"terraform|opentofu|pulumi|infrastructure as code|\biac\b", ["part-4/04-*"]),
    "AWS":                 (r"\baws\b|amazon web services|\bs3\b|\blambda\b|\bec2\b", []),
    "GCP":                 (r"\bgcp\b|google cloud",                    []),
    "Azure":               (r"\bazure\b",                               []),
    "CI/CD":               (r"ci/cd|\bci\b.*\bcd\b|github actions|jenkins|gitlab ci|argo", ["part-1/27-*", "part-2/15-*"]),
    "Progressive delivery":(r"canary|blue.green|progressive delivery|argo rollouts|flagger", ["part-4/08-*"]),
    "GitOps":              (r"gitops|argocd|argo cd|flux",              ["part-1/27-*"]),
    "Helm / Kustomize":    (r"\bhelm\b|kustomize",                      []),
    "Linux":               (r"\blinux\b|\bunix\b",                      ["part-4/02-*"]),
    "Networking / TCP/IP": (r"\btcp\b|\bdns\b|load balanc|\bhttp/2\b|networking|\bbgp\b", ["part-4/03-*", "part-1/15-*"]),
    "gRPC / Protobuf":     (r"grpc|protobuf|protocol buffers",          ["part-2/18-*"]),
    "REST APIs":           (r"\brest(ful)?\b|\bapis?\b",                ["part-1/19-*", "part-1/20-*"]),
    "GraphQL":             (r"graphql",                                 ["appendix/45-*"]),
    "Microservices":       (r"microservice",                            ["part-1/24-*"]),
    "PostgreSQL":          (r"postgres",                                ["part-1/18-*", "part-3/03-*"]),
    "MySQL":               (r"\bmysql\b",                               ["part-1/18-*"]),
    "NoSQL / Mongo / Dynamo": (r"mongodb|dynamodb|cassandra|nosql",     []),
    "Redis":               (r"\bredis\b",                               ["part-1/22-*"]),
    "Kafka":               (r"\bkafka\b",                               ["part-3/07-*"]),
    "RabbitMQ / NATS / SQS": (r"rabbitmq|\bnats\b|\bsqs\b|pub/?sub",    ["part-3/05-*", "appendix/52-*"]),
    "Elasticsearch":       (r"elasticsearch|opensearch",                []),
    "Concurrency":         (r"concurren|goroutine|channels?\b|parallel", ["part-1/04-*", "part-2/06-*", "part-2/07-*"]),
    "Distributed systems": (r"distributed systems?|consensus|raft|paxos", ["part-2/23-*", "part-2/24-*", "appendix/40-*"]),
    "Observability":       (r"observability|prometheus|grafana|opentelemetry|\botel\b|tracing|datadog", ["part-2/11-*", "part-4/06-*", "appendix/53-*"]),
    "SRE / on-call":       (r"\bsre\b|reliability|on-call|incident|\bslo\b", ["part-4/06-*", "part-2/12-*"]),
    "Performance":         (r"performance|latency|low.latency|profil|optimi[sz]", ["part-2/10-*", "appendix/41-*"]),
    "Testing":             (r"\btest(ing|s)?\b|\btdd\b|unit test|integration test", ["part-1/09-*", "part-1/10-*"]),
    "Security":            (r"security|secure|owasp|vulnerab|encryption|\btls\b", ["part-2/14-*", "part-3/12-*", "appendix/19-*"]),
    "Identity / IAM / OAuth": (r"\biam\b|oauth|\boidc\b|\bsaml\b|\bsso\b|identity|authn|authz|rbac", ["appendix/35-*", "appendix/44-*", "part-3/13-*"]),
    "Cryptography / PKI":  (r"cryptograph|\bpki\b|certificate|\bkms\b|\bhsm\b", ["appendix/22-*"]),
    "Supply chain / SBOM": (r"supply chain|\bsbom\b|sigstore|cosign|\bslsa\b", ["part-4/09-*"]),
    "eBPF":                (r"\bebpf\b",                                ["appendix/39-*"]),
    "Operators / CRDs":    (r"operator|controller-runtime|\bcrd\b",     ["part-4/05-*", "appendix/43-*"]),
    "Workflow engines":    (r"temporal|cadence|workflow engine",        ["appendix/51-*"]),
    "AI / LLM / agents":   (r"\bllm\b|\bai\b|machine learning|\bml\b|agent|rag\b|vector", ["part-2/19-*", "appendix/48-*", "appendix/50-*"]),
    "Payments / fintech":  (r"payment|fintech|ledger|banking|financial", ["part-3/01-*", "part-3/02-*", "part-3/09-*"]),
    "WebSockets / realtime": (r"websocket|real.?time|streaming",        ["appendix/30-*"]),
    "System design":       (r"system design|architecture|scalab",       ["part-1/14-*", "part-2/17-*"]),
    "Python":              (r"\bpython\b",                              []),
    "TypeScript / JS":     (r"typescript|javascript|\breact\b|node\.?js", []),
    "Rust / C++ / Java":   (r"\brust\b|c\+\+|\bjava\b(?!script)",       []),
}

def is_go(l):
    return re.search(r"\bgo(lang)?\b", f"{l.get('title','')} {l.get('description','')}", re.I) is not None

def covered(globs):
    return sorted({os.path.basename(p) for g in globs for p in glob.glob(os.path.join(ROOT, g))})

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file"); ap.add_argument("--cap", type=int, default=3)
    a = ap.parse_args()
    rows = json.load(open(a.file))
    go = [l for l in rows if is_go(l)]
    seen = collections.Counter(); kept = []
    for l in go:
        c = l.get("company", "?")
        if seen[c] < a.cap: kept.append(l); seen[c] += 1
    with_desc = sum(1 for l in kept if len(l.get("description", "")) > 200)
    print(f"{len(rows)} listings, {len(go)} Go roles, {len(kept)} after capping {a.cap} per company, "
          f"{with_desc} with a real description")
    if with_desc < len(kept) / 2:
        print("WARNING: most listings have no description, so only title keywords can match.\n")
    hits = collections.Counter(); who = collections.defaultdict(list)
    for l in kept:
        text = f"{l.get('title','')} {l.get('description','')}"
        for name, (rx, _) in SKILLS.items():
            if re.search(rx, text, re.I): hits[name] += 1; who[name].append(l["company"])
    print(f"{'skill':26} {'listings':>8} {'share':>6}  book coverage")
    for name, n in hits.most_common():
        ch = covered(SKILLS[name][1])
        cov = ", ".join(ch[:3]) + (f" +{len(ch)-3}" if len(ch) > 3 else "") if ch else "NOT COVERED"
        print(f"{name:26} {n:>8} {100*n/len(kept):5.0f}%  {cov}")
    gaps = [(n, c) for c, n in hits.items() if not covered(SKILLS[c][1])]
    print("\nGaps (asked for, no chapter):", ", ".join(f"{c} ({n})" for n, c in sorted(gaps, reverse=True)) or "none")

if __name__ == "__main__":
    main()
