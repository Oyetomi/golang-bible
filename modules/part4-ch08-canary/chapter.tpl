---
title: "Progressive Delivery: A Canary That Judges Itself"
part: 4
order: 8
type: "course"
description: "Shipping a new version to 5% of traffic first, and letting the numbers decide: a controller in Go (client-go and the Prometheus API, on a kind cluster running Kubernetes 1.37 and Prometheus 3.15.0) that shifts 5, 25, 50 and 100% of the replicas to a canary and judges it on its own error rate against the 99.9% SLO from chapter 6. Measured at 100 requests a second: a plain rolling update to a build failing 5% of requests failed 307 of 7,477 and would have kept failing; the canary controller stopped the same build after 9.7 seconds, with 6 failures out of 6,875 requests; a good build was promoted in 92.7 seconds with none out of 12,819. Found on the way: a replica-ratio split measured 5.4%, 25.9% and 51.2% for 5, 25 and 50%; a 5% bug at 5% weight is only a burn rate of 2.5 if you judge the whole fleet, so the canary must be judged alone; and the first good release still dropped 75 requests until the app learned to drain."
prerequisites: ["capstone-ledger-to-production"]
---

<HeroCard label="Part 4 · Chapter 8" title="Progressive Delivery: A Canary That Judges Itself">

The capstone got the ledger to production without dropping a request on deploy. It did nothing about the deploy that is *wrong*. A rolling update replaces every pod with the new version as fast as the pods start, and if the new version is broken, it replaces the good ones with broken ones and calls that a success. Nothing in Kubernetes knows what "broken" means.

The fix is old and simple: **release to a few users first, and look**. This chapter builds the part that looks. A controller in Go moves 5% of the traffic to the new version, asks Prometheus how those requests are doing, and either goes on to 25%, 50% and 100%, or puts everything back. The bar it judges against is the SLO from chapter 6.

Five stops:

1. **Why rolling hides it.** A bad build under a plain rolling update, measured.
2. **Splitting the traffic.** Two Deployments behind one Service, and what split you really get.
3. **Asking the numbers.** The Prometheus query, the SLO as a threshold, and three ways the answer can be wrong.
4. **The controller.** The loop: step, wait, judge, promote or abort.
5. **Two releases.** A bad build and a good one, side by side, and the bug the good one exposed.

</HeroCard>

<Narrator>
A rolling update is a very polite way to break everything. Every pod is replaced in an orderly fashion, and every one of them is wrong. Today you teach the release to look before it leaps. I'm told that's called "maturity". I've never tried it.
</Narrator>

<ChapterTabs tabs={["Why Rolling Hides It", "Splitting the Traffic", "Asking the Numbers", "The Controller", "Two Releases"]} />

<ProjectMap
  root="p4c08"
  files={[
    { path: "go.mod", status: "new", note: "client_golang v1.24.1 for the app, client-go v0.37.1 for the controller" },
    { path: "app/main.go", status: "new", note: "ledger-api: POST /transfer, /metrics with a version label, a bug switch, graceful shutdown" },
    { path: "Dockerfile", status: "new", note: "one multi-stage build for the app and the load generator" },
    { path: "cmd/load/main.go", status: "new", note: "100 requests a second, counted by the version that answered" },
    { path: "cmd/canary/main.go", status: "new", note: "the controller: steps, Prometheus queries, abort and promote" },
    { path: "deploy/ledger.yaml", status: "new", note: "one Service, two Deployments: ledger-stable (20 replicas) and ledger-canary (0)" },
    { path: "deploy/prometheus.yaml", status: "new", note: "Prometheus 3.15.0 scraping every pod once a second" },
    { path: "run.sh", status: "new", note: "the three releases, each under the same load" }
  ]}
  run={["kind create cluster --name canary", "docker build -t ledger-api:v1 . && kind load docker-image ledger-api:v1 --name canary", "kubectl apply -f deploy/ && kubectl port-forward svc/prometheus 9090:9090 &", "./run.sh rolling", "./run.sh bad", "./run.sh good"]}
>

The service is a small stand-in for the ledger: it has one endpoint that does a little work and can fail on purpose, so a "bad release" is something we can switch on and measure. Everything around it is the real thing: a kind cluster (Kubernetes 1.37.0), Prometheus 3.15.0 in the cluster, and a controller talking to the real API server.

</ProjectMap>

## Why Rolling Hides It

*Stop 1 of 5.*

### Step 1: a service that can be wrong on purpose

To practise releasing a bad build you need one. The service below answers `POST /transfer` after a few milliseconds of "work", and the environment variable `BUG_RATE` makes it fail that fraction of requests with a 500. The same image plays version 1 (`BUG_RATE=0`) and version 2 (`BUG_RATE=0.05`), so that the only thing that differs between releases is the thing we're testing: how the release behaves.

Every request is counted in a Prometheus counter labelled with the **version** and the **status code**. That label is what will let us judge the new version on its own numbers later.

@@code('app/main.go',1,46,label='app/main.go')@@

The other half of the file matters just as much, and it is the part that took a failed measurement to get right, in stop 5. When Kubernetes stops a pod it sends SIGTERM; a Go program that ignores it dies on the spot, in the middle of whatever it was serving. This one stops accepting new connections and lets the ones in flight finish:

@@code('app/main.go',48,64,label='app/main.go')@@

### Step 2: the Deployment and its readiness probe

Twenty replicas of version 1 sit behind a Service. The readiness probe asks the pod's `/healthz` once a second. The `preStop` hook makes a stopping pod wait three seconds before it gets SIGTERM, so the network has time to stop sending it traffic (the capstone's drain race, in two lines).

@@code('deploy/ledger.yaml',1,40,lang='yaml',label='deploy/ledger.yaml')@@

Notice what the readiness probe tests: *the process is up and answering `/healthz`*. A version that answers `/healthz` and fails every fifth transfer is, as far as Kubernetes can tell, perfectly healthy. That's the whole problem, in one line.

### Step 3: the release nobody is watching

A rolling update is one command. Under 100 requests a second from a pod inside the cluster, this changes the Deployment to version 2, the build that fails 5% of transfers:

```bash title="run.sh · the rolling case"
kubectl set env deploy/ledger-stable VERSION=v2 BUG_RATE=0.05
kubectl rollout status deploy/ledger-stable
```

Kubernetes replaces the pods a quarter at a time (`maxSurge` and `maxUnavailable` default to 25%), waiting only for each new pod to become ready. All twenty were replaced in about four seconds. This is the result, counted by the version that answered:

```text title="./run.sh rolling · measured"
total  v1/204=988 v2/204=6182 v2/500=307
```

**307 of 7,477 requests failed** (4.1%), and the failures did not stop: the run ended only because the load generator did. In production nobody presses stop until a person notices, and the person who notices is usually a customer. The rollout was, by every measure Kubernetes has, a success.

<RuntimeStage
  title="A rolling update replaces good pods with bad ones, and reports success"
  kicker="rolling update · measured at 100 requests a second"
  zones={[
    { id: "old", label: "ledger-stable, v1", sub: "20 pods, 0% errors", x: 16, y: 16, w: 356, h: 200, kind: "cpu" },
    { id: "rollout", label: "the rolling update", sub: "maxSurge 25%, maxUnavailable 25%", x: 388, y: 16, w: 356, h: 200, kind: "chan" },
    { id: "new", label: "ledger-stable, v2", sub: "20 pods, 5% of requests fail", x: 16, y: 236, w: 356, h: 200, kind: "wait" },
    { id: "verdict", label: "kubectl rollout status", sub: "\"successfully rolled out\"", x: 388, y: 236, w: 356, h: 200, kind: "exit" }
  ]}
  actors={[
    { id: "a", label: "pod 1", kind: "value" }, { id: "b", label: "pod 2", kind: "value" }, { id: "c", label: "pod 3", kind: "value" },
    { id: "d", label: "500s keep coming", kind: "value" }
  ]}
  events={[
    { at: 0, id: "a", to: "old", state: "running", clock: "v1", note: "Twenty pods of version 1 serve 100 requests a second. Nothing fails." },
    { at: 0.1, id: "b", to: "old", state: "running" }, { at: 0.2, id: "c", to: "old", state: "running" },
    { at: 2.0, id: "a", to: "rollout", state: "running", clock: "rolling", note: "kubectl set env changes the pod template. The Deployment starts new pods and removes old ones a quarter at a time, moving on as soon as each new pod passes its readiness probe." },
    { at: 3.4, id: "b", to: "rollout", state: "running" }, { at: 3.6, id: "c", to: "rollout", state: "running" },
    { at: 5.2, id: "a", to: "new", state: "running", beat: "problem", note: "The new pods answer /healthz, so they are ready. That probe says nothing about whether transfers work, so version 2 takes over the fleet." },
    { at: 5.4, id: "b", to: "new", state: "running", beat: "problem" }, { at: 5.6, id: "c", to: "new", state: "running", beat: "problem" },
    { at: 7.0, id: "d", to: "verdict", state: "done", beat: "problem", note: "About four seconds after it started: 'successfully rolled out'. Over the 75-second run 307 of 7,477 requests failed, and it would have gone on failing until a person noticed." }
  ]}
  caption="The rollout is fast and orderly and blind. Kubernetes checks that the process is alive, not that the release is any good."
/>

## Splitting the Traffic

*Stop 2 of 5.*

### Step 1: two Deployments, one Service

The alternative is to keep the old version running and add the new one **beside** it. The Service selects pods by the label `app: ledger`, and both Deployments put that label on their pods; only `track` (`stable` or `canary`) tells them apart. Whatever pods carry `app: ledger` receive traffic, so the split is decided by **how many pods each Deployment has**.

@@code('deploy/ledger.yaml',42,70,lang='yaml',label='deploy/ledger.yaml')@@

The canary Deployment starts with zero replicas. To send 5% of traffic to it, scale it to 1 and stable to 19.

### Step 2: what split do you actually get?

Kubernetes doesn't promise 5%; it promises that a new connection goes to some ready pod, chosen at random. So the number is worth measuring. The load generator opens a **new connection for every request** (keep-alive would pin it to one pod and hide the split completely) and counts which version answered:

@@code('cmd/load/main.go',25,27,label='cmd/load/main.go')@@

```text title="measured · 100 requests a second for 30 seconds each"
canary  1 of 20 pods ( 5%):  v1=2755  v2=156     -> 5.4% to the canary
canary  5 of 20 pods (25%):  v1=2103  v2=734     -> 25.9%
canary 10 of 20 pods (50%):  v1=1316  v2=1380    -> 51.2%
```

Close to the replica ratio, with the noise you'd expect from random choice. Two things follow:

- **The granularity is one pod.** With 10 replicas, the smallest canary is 10%. To get 5% you need 20 replicas (or a smarter router). The controller therefore keeps `total = 20` fixed and moves pods between the two Deployments.
- **The split is by connection, not by user.** A client that keeps one connection open stays on one version. That's fine for a health signal and unacceptable for anything that needs "this user always sees the new version"; that needs a router that can look at headers or cookies (see Under the Hood).

<RuntimeStage
  title="One Service, two Deployments: the pod count is the traffic split"
  kicker="replica ratio · measured over 30-second runs"
  zones={[
    { id: "load", label: "the load pod", sub: "100 requests a second, a new connection each", x: 16, y: 16, w: 236, h: 200, kind: "plain" },
    { id: "svc", label: "Service: ledger", sub: "selects app=ledger, so both tracks", x: 262, y: 16, w: 236, h: 200, kind: "chan" },
    { id: "stable", label: "ledger-stable, v1", sub: "19 pods", x: 508, y: 16, w: 236, h: 200, kind: "cpu" },
    { id: "canary", label: "ledger-canary, v2", sub: "1 pod (5%)", x: 262, y: 236, w: 236, h: 200, kind: "wait" },
    { id: "measure", label: "measured", sub: "5.4% v2 at 1 of 20 · 25.9% at 5 of 20 · 51.2% at 10 of 20", x: 508, y: 236, w: 236, h: 200, kind: "exit" }
  ]}
  actors={[
    { id: "r1", label: "request", kind: "value" }, { id: "r2", label: "request", kind: "value" }, { id: "r3", label: "request", kind: "value" }, { id: "r4", label: "request", kind: "value" }
  ]}
  events={[
    { at: 0, id: "r1", to: "load", clock: "5%", note: "The load pod sends a request on a fresh connection, so that every request is a new draw." },
    { at: 0.1, id: "r2", to: "load" }, { at: 0.2, id: "r3", to: "load" }, { at: 0.3, id: "r4", to: "load" },
    { at: 1.6, id: "r1", to: "svc", state: "running", note: "The Service has 20 ready pods behind it, because both Deployments carry app: ledger. It picks one at random for each new connection." },
    { at: 1.7, id: "r2", to: "svc", state: "running" }, { at: 1.8, id: "r3", to: "svc", state: "running" }, { at: 1.9, id: "r4", to: "svc", state: "running" },
    { at: 3.4, id: "r1", to: "stable", state: "done", note: "Nineteen pods in twenty are stable, so nearly every request lands there." },
    { at: 3.5, id: "r2", to: "stable", state: "done" }, { at: 3.6, id: "r3", to: "stable", state: "done" },
    { at: 3.8, id: "r4", to: "canary", state: "running", beat: "solution", note: "About one in twenty reaches the single canary pod: the release is exposed to 5% of users, and a bug can hurt only that many." },
    { at: 6.0, id: "r4", to: "measure", state: "done", note: "Measured, 100 requests a second for 30 seconds each: 156 of 2,911 requests (5.4%) reached v2 with one canary pod, 734 of 2,837 (25.9%) with five, 1,380 of 2,696 (51.2%) with ten." }
  ]}
  caption="The split is decided by how many pods each Deployment has, and it is random per connection. One pod is the smallest step you can take."
/>

## Asking the Numbers

*Stop 3 of 5.*

### Step 1: one scrape per second

The canary can only be judged if Prometheus is watching it, and a canary that lives for twenty seconds needs a fast scrape. This Prometheus (3.15.0, the version from chapter 6) finds pods by asking the Kubernetes API, keeps the ones annotated `prometheus.io/scrape`, and scrapes each one every second.

@@code('deploy/prometheus.yaml',19,36,lang='yaml',label='deploy/prometheus.yaml')@@

### Step 2: the SLO as a number

Chapter 6 gave us the vocabulary. An SLO of 99.9% leaves an **error budget** of 0.1%: one request in a thousand may fail. A **burn rate** of 1 uses the budget exactly as fast as the month allows, and 14.4 is the fast-burn page from chapter 6: 2% of a month's budget in one hour. Turned into an error ratio, that's `14.4 × 0.001 = 1.44%`. A canary whose own requests fail at 1.44% or more is burning budget fast enough that, at full traffic, someone would be woken up. It shouldn't go any further.

### Step 3: judge the canary alone

Here is the first place the answer can be wrong. It is tempting to reuse the alert from chapter 6, which looks at the whole service. But at 5% weight, a version that fails 5% of its requests contributes only **0.25%** of the fleet's requests as errors (`0.05 × 0.05`), a burn rate of just 2.5, well under the 14.4 line. The fleet-wide alert stays silent while the canary is on fire, because 95% of the traffic is going to the healthy version.

That's why the metric has a `version` label. The controller asks about the canary's own requests, over the last ten seconds:

@@code('cmd/canary/main.go',145,174,label='cmd/canary/main.go')@@

Two design decisions are hiding in there.

**No data is not a pass.** The first seconds after a canary starts, Prometheus hasn't scraped it yet: the query returns an empty result. `scalar` turns that into zero requests, and the controller (next stop) treats too few requests as *wait*. The alternative, dividing by zero and getting `NaN`, is worse than it looks: in Go and in PromQL, `NaN` is not greater than anything, so "is the error ratio over the limit?" quietly answers *no*, and a canary that was never measured gets promoted.

**Enough requests to judge.** At 5% weight and 100 requests a second the canary serves about five requests a second. One unlucky failure among ten requests is 10%; the controller waits until at least 30 requests are in the window before it trusts the ratio. The exercise at the end asks how many are enough.

## The Controller

*Stop 4 of 5.*

The controller is one loop over the steps (5, 25, 50, 100). Each step scales the two Deployments, waits for them to be ready, then judges for twenty seconds. Its inputs are flags, so the same program can run a cautious release or a quick one.

### Step 1: the setup

The fixed numbers first: twenty replicas whatever the split, and the SLO. Then the flags, the two clients (one for the Kubernetes API through the same kubeconfig `kubectl` uses, one for Prometheus), and the list of steps.

@@code('cmd/canary/main.go',27,65,label='cmd/canary/main.go')@@

### Step 2: abort first

The rollback is defined before the loop, because it is called from inside it. It brings stable back to full strength **first**, waits until those pods are ready, and only then removes the canary. The order matters at the last step, where the canary is serving 100%: removing it first would leave the service with no pods at all while the stable ones start.

@@code('cmd/canary/main.go',67,81,label='cmd/canary/main.go')@@

### Step 3: the loop

For each step, the canary goes **up** before stable goes down, so capacity never drops below twenty pods. Then, for the hold time, the controller asks the question every two seconds and acts on one of three answers: an error reading the metrics (abort: an unmeasured canary is not a healthy one), too few requests (wait), or a burn rate to compare with the limit.

@@code('cmd/canary/main.go',83,119,label='cmd/canary/main.go')@@

### Step 4: promote, and the two helpers

Promotion has the same care. When the canary has served 100% and stayed healthy, the stable Deployment (which has no pods at this point, so changing its template restarts nothing) is given the canary's image and settings, scaled up to twenty, and only when those pods are ready is the canary removed. There's never a moment without capacity.

@@code('cmd/canary/main.go',121,143,label='cmd/canary/main.go')@@

The last two functions are the plumbing: set a Deployment's replica count through its scale subresource, and wait until exactly that many pods are ready.

@@code('cmd/canary/main.go',176,195,label='cmd/canary/main.go')@@

## Two Releases

*Stop 5 of 5.*

### Step 1: the bad build

The same build that failed 307 requests under the rolling update, released by the controller under the same load. The controller's log is the evidence (seconds since it started):

```text title="./run.sh bad · measured"
  0.0s  step 5%: 1 canary + 19 stable replicas
  5.7s    waiting for data: 0 requests in the window (need 30)
  7.7s    waiting for data: 18 requests in the window (need 30)
  9.7s    requests    31  error ratio  7.553%  burn  75.5  BREACH
  9.7s  ABORT: canary burn rate 75.5 is at or above 14.4
 11.2s  rolled back: 20 stable, 0 canary
total  v1/204=6833 v2/204=36 v2/500=6
```

The canary was live for 9.7 seconds and gone 1.5 seconds after that. **Six of 6,875 requests failed**, against 307 of 7,477 under the rolling update: the same bug, exposed to 42 requests instead of about 7,000 users' worth of traffic, and undone with nobody watching.

Another run of the same release aborted at 16.1 seconds after three failures (`total v1/204=7300 v2/204=67 v2/500=3`). The time varies because the bug fires at random: the controller decides when enough of its failures have landed in the window, and that's a matter of luck. Both runs agree on the point: a broken release exposes a few dozen requests, not thousands.

<RuntimeStage
  title="The canary controller catches the bad build in 9.7 seconds"
  kicker="canary · measured at 100 requests a second, build fails 5%"
  zones={[
    { id: "ctl", label: "controller", sub: "step 5%: 1 canary, 19 stable", x: 16, y: 16, w: 356, h: 200, kind: "cpu" },
    { id: "prom", label: "Prometheus", sub: "the canary's own requests, last 10 s", x: 388, y: 16, w: 356, h: 200, kind: "queue" },
    { id: "canary", label: "the canary pod, v2", sub: "5% of traffic, 5% of it failing", x: 16, y: 236, w: 356, h: 200, kind: "wait" },
    { id: "back", label: "rolled back: 20 stable, 0 canary", sub: "6 of 6,875 requests failed", x: 388, y: 236, w: 356, h: 200, kind: "exit" }
  ]}
  actors={[
    { id: "step", label: "step 5%", kind: "value" }, { id: "q1", label: "0, then 18 requests", kind: "value" }, { id: "q2", label: "31 requests, 7.6%", kind: "value" }, { id: "stop", label: "ABORT", kind: "value" }
  ]}
  events={[
    { at: 0, id: "step", to: "ctl", state: "running", clock: "0.0 s", note: "The controller scales the canary to one pod and stable to nineteen, and waits for both to be ready." },
    { at: 1.6, id: "step", to: "canary", state: "running", note: "About five requests a second now reach the canary. Some fail." },
    { at: 3.2, id: "q1", to: "prom", state: "parked", clock: "5.7 s", note: "First look: 0 requests in the window (the pod was still starting, and Prometheus hadn't scraped it). The controller needs 30 before it trusts a ratio, so it waits. Not enough data is never a pass." },
    { at: 5.0, id: "q1", to: "ctl", state: "parked" },
    { at: 6.6, id: "q2", to: "prom", state: "running", clock: "9.7 s", beat: "problem", note: "31 requests, 7.553% failing: a burn rate of 75.5 against a limit of 14.4." },
    { at: 8.2, id: "q2", to: "ctl", state: "running", beat: "problem" },
    { at: 9.4, id: "stop", to: "ctl", state: "running", beat: "problem", note: "BREACH. The controller aborts: stable back to twenty pods first, then the canary removed." },
    { at: 11.4, id: "stop", to: "back", state: "done", beat: "solution", clock: "11.2 s", note: "Rolled back 1.5 seconds after the decision. Total damage: 6 failed requests. The rolling update failed 307 with the same build." }
  ]}
  caption="The controller waits until it has enough data, judges the canary's own requests against the SLO's fast-burn line, and undoes the release on its own."
/>

### Step 2: the good build

The same controller with a build that doesn't fail. It goes through all four steps and promotes:

```text title="./run.sh good · measured (an excerpt: the last judgement of each step, then the step)"
  0.0s  step 5%: 1 canary + 19 stable replicas
 22.2s    requests    60  error ratio  0.000%  burn   0.0  ok
 22.2s  step 25%: 5 canary + 15 stable replicas
 44.8s    requests   241  error ratio  0.000%  burn   0.0  ok
 44.8s  step 50%: 10 canary + 10 stable replicas
 66.4s    requests   482  error ratio  0.000%  burn   0.0  ok
 66.4s  step 100%: 20 canary + 0 stable replicas
 89.6s    requests   991  error ratio  0.000%  burn   0.0  ok
 89.6s  100% of traffic is on the canary and healthy: promoting
 92.7s  promoted: 20 stable replicas now run the new version, canary scaled to 0
total  v1/204=5966 v2/204=6853
```

**No request failed out of 12,819**, including during the promotion. The counts show the hand-over working: 5,966 requests were served by version 1 in the early steps and 6,853 by version 2, while the number of requests the canary served in each ten-second window grew from 60 to 241, 482 and 991 as its share rose from 5% to 25%, 50% and 100%.

### Step 3: the first attempt wasn't clean

The results above are the *second* time through. The first good release also had no failed 500s, but the load generator reported this, as its final periodic count:

```text title="first good run, before the app handled SIGTERM · the last count before the run ended"
t=130s  ?/error=75 v1/204=6112 v2/204=6716
```

Seventy-five requests died with connection errors (the `?` version means no response arrived), and the first plain rolling update had 82 of them on top of its 307 500s. None came from the bug. They came from *removing pods*: every time the controller scaled a Deployment down, terminating pods dropped the connections they were in the middle of, because the app exited the moment it got SIGTERM. It's the capstone's lesson again, in a new place: **a release strategy is only as safe as the pod shutdown under it**. The fix was the two changes you saw in stop 1: shut down gracefully on SIGTERM, and sleep three seconds in `preStop` so the network stops sending traffic first. After it, the same runs had no connection errors at all: 0 with the rolling update, and 0 with the canary.

That's the real reason the controller scales the canary up before stable goes down, and the reason `abort` restores stable before it removes the canary. Ordering is what stops the controller from hurting people while it is protecting them.

<QuickCheck
  question="The canary serves 5% of traffic and fails 5% of its requests. Why does an alert on the whole fleet's error ratio not catch it?"
  options={[
    "Prometheus can't scrape two Deployments at once",
    "The fleet's error ratio is only about 0.25%, a burn rate near 2.5, under the 14.4 threshold, because 95% of requests are healthy",
    "A canary's errors are not counted by the SLO",
    "The alert only fires for 500s from stable pods"
  ]}
  answer={1}
  explain="0.05 × 0.05 = 0.25% of the fleet's requests. Divided by the 0.1% budget that's a burn rate of 2.5. The canary's own ratio is 5%, a burn rate of 50. Judge the canary on its own version label."
/>

<QuickCheck
  question="Prometheus returns an empty result for the canary's requests during the first seconds. What should a release controller do?"
  options={[
    "Treat it as zero errors and continue: nothing failed",
    "Abort the release immediately",
    "Wait, and never promote until it has enough requests to judge",
    "Skip the check for that step"
  ]}
  answer={2}
  explain="No data means the canary hasn't been measured, which is different from being healthy. Continuing on an empty result (or on a NaN from 0/0) is how an unmeasured version gets promoted."
/>

<QuickCheck
  question="Why does the controller scale the canary up before it scales stable down?"
  options={[
    "Kubernetes requires it",
    "So capacity never drops below the total while pods start",
    "So the canary gets more traffic",
    "Because Deployments can only be scaled in that order"
  ]}
  answer={1}
  explain="New pods take time to become ready. Bringing them up first, and only then removing old ones, keeps the number of ready pods at or above the total the whole time."
/>

<UnderTheHood title="What Argo Rollouts and Flagger do differently, and what a replica split can't do">

This chapter's controller is the same idea as the two well-known tools for it, **Argo Rollouts** and **Flagger**, in about 200 lines: step the traffic, query a metrics system, promote or roll back. It's worth building once to see the loop. It's also worth knowing what those tools add, because the replica-ratio split has real limits. (They weren't run for this chapter, so nothing here compares their behaviour with the measurements above.)

**Finer, controlled traffic weights.** The split here is by pod count and random per connection: 5% needs 20 pods, and it can't do 1% at all. Rollout controllers can instead adjust weights in an ingress, a Gateway API `HTTPRoute`, or a service mesh, so that 1% of traffic goes to one canary pod whatever the pod counts are.

**Routing by who, not by luck.** With header or cookie matching, internal users or a chosen cohort can always be the canary, and a user doesn't flip between versions on every request.

**Analysis as a declared object.** Instead of flags, the checks (which query, how often, how many failures are allowed) are described in a resource, so they can be reviewed and reused across services.

**The statistics.** With little traffic, a ratio over ten seconds is noisy; a single failure among 30 requests is 3.3%, over this controller's 1.44% line. Real systems require a minimum sample size, look at more than one window, and often compare the canary with the stable version at the same moment ("is it worse than the baseline?") instead of with a fixed number.

The safest part is also the one that's easiest to forget: **a canary only tests what its traffic exercises**. A bug that appears on a rare path, or after a day of memory growth, won't show in a twenty-second window. Progressive delivery narrows the blast radius; it doesn't replace tests.

</UnderTheHood>

## Exercises

<Exercise n={1} title="How many requests are enough?" level="medium">

The controller waits for 30 requests in the window. Suppose the canary is healthy but one request in the window fails, by bad luck. With `minReqs = 30` and a limit of 1.44%, does the controller abort? What is the smallest number of requests for which a single failure is *not* enough to abort?

<Solution>

One failure in 30 is 3.3%, a burn rate of 33, so it aborts a healthy canary. One failure stays under 1.44% only when `1/n < 0.0144`, so `n ≥ 70` (1/70 = 1.43%). With 5% weight and 100 requests a second, 70 requests take about 14 seconds, so the window must be longer, or the first step's weight higher. The trade is speed against false aborts: a bigger minimum makes the controller slower to catch a real bug at the 5% step.

</Solution>

</Exercise>

<Exercise n={2} title="A manual gate before 100%" level="easy">

Add a `-pause-at` flag: after the 50% step, wait for the operator to press Enter before continuing. Why is the pause better after 50% than after 5%?

<Solution>

Read a line from `os.Stdin` after the step where `pct == *pauseAt` finishes its hold. After 5% almost nothing has been learned yet (few requests, few users); by 50% the metrics are meaningful and the last step is the one that removes the safety net (stable pods disappear), so it is where a human decision is most useful. During the pause the release stays at 50/50, which is stable and safe to leave.

</Solution>

</Exercise>

<Exercise n={3} title="Compare with the baseline" level="hard">

Instead of a fixed 1.44% limit, abort when the canary's error ratio exceeds the stable version's ratio by more than 1 percentage point over the same window. Write the two queries. What does this catch that the fixed threshold misses, and what does it get wrong?

<Solution>

The canary query is the one in `canaryHealth`; the stable one is the same with `version="v1"`. Compare `canaryRatio - stableRatio > 0.01`. It catches a release that is worse than the baseline while both are affected by a shared problem (a slow database making everything fail 3%): the fixed limit would abort a canary that isn't to blame. It gets wrong the case where both are broken by the same cause and you'd rather know: it will promote, because the canary is no worse. It also needs enough stable traffic and a stable that is itself healthy. In practice you use both: an absolute ceiling and a comparison with the baseline.

</Solution>

</Exercise>

---

## The Lab

<Lab
  title="Judge the Canary, Not the Fleet"
  archetype="fix-it"
  difficulty="guided"
  points={100}
  hintCost={10}
  verify="self-check"
  expect="ALL CHECKS PASS"
  objective="Decide judges the wrong traffic and trusts too little data: it adds the stable version's errors to the canary's, divides by all requests (so a bad canary is diluted by healthy stable traffic and the stable version's failures wrongly count against the canary), and with no requests at all it divides zero by zero and continues. Fix it to judge only the canary, wait until the canary has served minReq requests, and abort at maxBurn or above."
  starter={`@@LAB@@`}
  verifier="Checks Decide on a bad canary hidden among healthy stable traffic, on no traffic and too little traffic, on a healthy canary, on 1% and 1.5% error ratios (burns of 10 and 15 against a limit of 14.4), and on a failing stable version with a healthy canary. Prints ALL CHECKS PASS."
  hints={[
    "The ratio you need is CanaryErr divided by CanaryReq. The stable numbers are not part of the decision.",
    "Check the request count before dividing: if CanaryReq is below minReq, return Wait, and that includes zero.",
    "burn = ratio / (1 - slo). Abort when burn >= maxBurn."
  ]}
  flag="GO{judge_the_canary_alone}"
>

These are the decisions from stop 3 and stop 4, as one function, with every mistake a real controller has made.

</Lab>

<Recap>

- A **rolling update** trusts the readiness probe, which only says the process is alive. A build failing 5% of requests replaced the whole fleet in about 4 seconds and failed **307 of 7,477 requests**, with no end in sight.
- A **canary** puts the new version beside the old and sends it a share of traffic: two Deployments, one Service, and the pod count is the split. Measured, 1, 5 and 10 pods of 20 gave **5.4%, 25.9% and 51.2%**. The step is one pod, and the split is per connection.
- **Judge the canary alone.** Fleet-wide, a 5% bug at 5% weight is a burn rate of 2.5. On its own version label it's 50. The bar is the SLO's fast-burn line from chapter 6: **1.44%** for 99.9%.
- **No data is not a pass.** An empty result or a zero denominator means "wait". A minimum sample size stops one unlucky request from deciding a release, and the right size is arithmetic (70 requests, not 30, before one failure is under the limit).
- The controller aborted the bad build after **9.7 seconds with 6 failures out of 6,875**, and promoted the good build in **92.7 seconds with none out of 12,819**.
- **Ordering keeps a release from hurting people.** Up before down, stable restored before the canary is removed, and a pod that shuts down gracefully: the first good run lost 75 requests to dropped connections until the app handled SIGTERM.

</Recap>

<Scoreboard
  streak={3}
  items={[
    { label: "Quick check: judging the fleet", kind: "quiz", points: 10, done: false },
    { label: "Quick check: empty result", kind: "quiz", points: 10, done: false },
    { label: "Quick check: scale order", kind: "quiz", points: 10, done: false },
    { label: "Exercise 1: how many requests", kind: "exercise", points: 15, done: false },
    { label: "Exercise 2: a manual gate", kind: "exercise", points: 10, done: false },
    { label: "Exercise 3: compare with the baseline", kind: "exercise", points: 20, done: false }
  ]}
  flag={{ label: "Lab: Judge the Canary, Not the Fleet", captured: false, points: 100 }}
/>

<Narrator>
Nine point seven seconds, six failed requests, and the bad build went home before anyone had their coffee. The rolling update needed a customer to complain. I prefer the controller: it never says "have you tried turning it off and on again". It just does. I find that relatable.
</Narrator>
