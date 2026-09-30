// canary releases a new version of ledger-api gradually and lets the
// numbers decide. At each step it shifts a share of the replicas to the
// canary Deployment, asks Prometheus how the canary's own requests are
// doing, and either moves on or puts everything back.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	promapi "github.com/prometheus/client_golang/api"
	promv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	total  = 20 // replicas behind the Service, whatever the split
	slo    = 0.999
	budget = 1 - slo // 0.1% of requests may fail
)

var (
	stable = "ledger-stable"
	canary = "ledger-canary"
)

func main() {
	stepsFlag := flag.String("steps", "5,25,50,100", "percent of traffic at each step")
	hold := flag.Duration("hold", 20*time.Second, "how long to judge each step")
	burnMax := flag.Float64("max-burn", 14.4, "abort at this burn rate (14.4 = the fast-burn page from chapter 6)")
	minReqs := flag.Float64("min-requests", 30, "requests the canary must have served in the window before we trust its numbers")
	promURL := flag.String("prom", "http://127.0.0.1:9090", "Prometheus")
	flag.Parse()

	cfg, err := clientcmd.BuildConfigFromFlags("", os.Getenv("HOME")+"/.kube/config")
	if err != nil {
		log.Fatal(err)
	}
	k8s := kubernetes.NewForConfigOrDie(cfg)
	pc, err := promapi.NewClient(promapi.Config{Address: *promURL})
	if err != nil {
		log.Fatal(err)
	}
	prom := promv1.NewAPI(pc)
	ctx := context.Background()

	var steps []int
	for _, s := range strings.Split(*stepsFlag, ",") {
		n, err := strconv.Atoi(s)
		if err != nil {
			log.Fatal(err)
		}
		steps = append(steps, n)
	}

	start := time.Now()
	say := func(format string, a ...any) {
		fmt.Printf("%5.1fs  %s\n", time.Since(start).Seconds(), fmt.Sprintf(format, a...))
	}

	abort := func(why string) {
		say("ABORT: %s", why)
		// Stable back to full strength first, canary removed last, for the
		// same reason as on the way up: capacity never dips.
		setReplicas(ctx, k8s, stable, total)
		waitReady(ctx, k8s, stable, total)
		setReplicas(ctx, k8s, canary, 0)
		say("rolled back: %d stable, 0 canary", total)
		os.Exit(1)
	}

	for _, pct := range steps {
		c := int(math.Round(float64(total) * float64(pct) / 100))
		s := total - c
		say("step %d%%: %d canary + %d stable replicas", pct, c, s)
		// Bring the canary up first, then take stable pods away, so capacity
		// never drops below the total.
		setReplicas(ctx, k8s, canary, c)
		waitReady(ctx, k8s, canary, c)
		setReplicas(ctx, k8s, stable, s)
		waitReady(ctx, k8s, stable, s)

		stepStart := time.Now()
		for time.Since(stepStart) < *hold {
			time.Sleep(2 * time.Second)
			n, ratio, err := canaryHealth(ctx, prom, 10*time.Second)
			switch {
			case err != nil:
				abort("cannot read the canary's metrics: " + err.Error())
			case n < *minReqs:
				say("  waiting for data: %.0f requests in the window (need %.0f)", n, *minReqs)
			default:
				burn := ratio / budget
				verdict := "ok"
				if burn >= *burnMax {
					verdict = "BREACH"
				}
				say("  requests %5.0f  error ratio %6.3f%%  burn %5.1f  %s", n, ratio*100, burn, verdict)
				if verdict == "BREACH" {
					abort(fmt.Sprintf("canary burn rate %.1f is at or above %.1f", burn, *burnMax))
				}
			}
		}
	}
	say("100%% of traffic is on the canary and healthy: promoting")
	promote(ctx, k8s)
	say("promoted: %d stable replicas now run the new version, canary scaled to 0", total)
}

// promote makes the stable Deployment run what the canary runs. Stable has
// no pods at this point, so changing its template restarts nothing; scaling
// it up then starts new-version pods while the canary still serves, and the
// canary is removed last. There is never a moment without capacity.
func promote(ctx context.Context, k8s kubernetes.Interface) {
	deployments := k8s.AppsV1().Deployments("default")
	c, err := deployments.Get(ctx, canary, metav1.GetOptions{})
	if err != nil {
		log.Fatal(err)
	}
	s, err := deployments.Get(ctx, stable, metav1.GetOptions{})
	if err != nil {
		log.Fatal(err)
	}
	s.Spec.Template.Spec.Containers[0].Env = c.Spec.Template.Spec.Containers[0].Env
	s.Spec.Template.Spec.Containers[0].Image = c.Spec.Template.Spec.Containers[0].Image
	if _, err := deployments.Update(ctx, s, metav1.UpdateOptions{}); err != nil {
		log.Fatal(err)
	}
	setReplicas(ctx, k8s, stable, total)
	waitReady(ctx, k8s, stable, total)
	setReplicas(ctx, k8s, canary, 0)
}

// canaryHealth asks Prometheus for the canary's request count and error
// ratio over the last window. No samples gives n = 0, which the caller
// treats as "wait", never as a pass.
func canaryHealth(ctx context.Context, prom promv1.API, window time.Duration) (float64, float64, error) {
	w := fmt.Sprintf("%ds", int(window.Seconds()))
	reqs, err := scalar(ctx, prom, fmt.Sprintf(`sum(increase(ledger_requests_total{version="v2"}[%s]))`, w))
	if err != nil {
		return 0, 0, err
	}
	bad, err := scalar(ctx, prom, fmt.Sprintf(`sum(increase(ledger_requests_total{version="v2",code=~"5.."}[%s])) or vector(0)`, w))
	if err != nil {
		return 0, 0, err
	}
	if reqs == 0 {
		return 0, 0, nil
	}
	return reqs, bad / reqs, nil
}

func scalar(ctx context.Context, prom promv1.API, q string) (float64, error) {
	v, _, err := prom.Query(ctx, q, time.Now())
	if err != nil {
		return 0, err
	}
	vec, ok := v.(model.Vector)
	if !ok || len(vec) == 0 {
		return 0, nil // an empty result: the metric doesn't exist yet
	}
	return float64(vec[0].Value), nil
}

func setReplicas(ctx context.Context, k8s kubernetes.Interface, name string, n int) {
	_, err := k8s.AppsV1().Deployments("default").UpdateScale(ctx, name, &autoscalingv1.Scale{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Spec:       autoscalingv1.ScaleSpec{Replicas: int32(n)},
	}, metav1.UpdateOptions{})
	if err != nil {
		log.Fatal(err)
	}
}

func waitReady(ctx context.Context, k8s kubernetes.Interface, name string, n int) {
	for range 120 {
		d, err := k8s.AppsV1().Deployments("default").Get(ctx, name, metav1.GetOptions{})
		if err == nil && int(d.Status.ReadyReplicas) == n && int(d.Status.Replicas) == n {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	log.Fatalf("%s never reached %d ready replicas", name, n)
}
