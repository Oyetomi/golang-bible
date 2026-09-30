// ledger-api is the service being released. Every version answers
// POST /transfer; a bad version fails a fraction of them (BUG_RATE),
// the way a real regression would. Metrics carry the version so a
// canary can be judged on its own numbers.
package main

import (
	"context"
	"errors"
	"log"
	"math/rand/v2"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	version := os.Getenv("VERSION")
	bug, _ := strconv.ParseFloat(os.Getenv("BUG_RATE"), 64)

	reqs := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "ledger_requests_total",
		Help: "Transfers by version and status code.",
	}, []string{"version", "code"})
	prometheus.MustRegister(reqs)

	http.HandleFunc("POST /transfer", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(time.Duration(2+rand.IntN(4)) * time.Millisecond) // the work
		if rand.Float64() < bug {
			reqs.WithLabelValues(version, "500").Inc()
			w.Header().Set("X-Version", version)
			http.Error(w, "ledger error", http.StatusInternalServerError)
			return
		}
		reqs.WithLabelValues(version, "204").Inc()
		w.Header().Set("X-Version", version)
		w.WriteHeader(http.StatusNoContent)
	})
	http.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	http.Handle("GET /metrics", promhttp.Handler())

	// On SIGTERM, stop accepting new connections and let in-flight requests
	// finish. Without this a terminating pod drops whatever it was serving.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	srv := &http.Server{Addr: ":8080"}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	log.Printf("ledger-api %s (bug rate %.0f%%) on :8080", version, bug*100)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
