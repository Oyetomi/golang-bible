// Package api is the HTTP edge: it turns requests into store calls and errors into status codes.
package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"ledgerd/internal/domain"
	"ledgerd/internal/store"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/time/rate"
)

type Server struct {
	Store  *store.Store
	Log    *slog.Logger
	Reg    *prometheus.Registry
	Limits *Limits // nil = no per-account limit

	transfers *prometheus.CounterVec
	latency   prometheus.Histogram
}

func New(s *store.Store, log *slog.Logger, limits *Limits) *Server {
	reg := prometheus.NewRegistry()
	srv := &Server{Store: s, Log: log, Reg: reg, Limits: limits,
		transfers: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "transfers_total", Help: "Transfers by result."}, []string{"result"}),
		latency:   prometheus.NewHistogram(prometheus.HistogramOpts{Name: "transfer_seconds", Help: "Transfer latency.", Buckets: prometheus.DefBuckets}),
	}
	reg.MustRegister(srv.transfers, srv.latency)
	for _, r := range []string{"ok", "replayed", "insufficient", "key_reuse", "invalid", "rate_limited", "error"} {
		srv.transfers.WithLabelValues(r) // pre-create so every series exists from the first scrape
	}
	return srv
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /transfers", s.transfer)
	mux.HandleFunc("GET /accounts/{id}/balance", s.balance)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.Handle("GET /metrics", promhttp.HandlerFor(s.Reg, promhttp.HandlerOpts{}))
	return s.withRequestID(mux)
}

type ctxKey struct{}

func (s *Server) withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			b := make([]byte, 6)
			rand.Read(b)
			id = hex.EncodeToString(b)
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func (s *Server) transfer(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req store.TransferReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil || req.Key == "" {
		s.transfers.WithLabelValues("invalid").Inc()
		writeJSON(w, 400, map[string]string{"error": "bad request"})
		return
	}
	if s.Limits != nil && !s.Limits.Allow(req.From) {
		s.transfers.WithLabelValues("rate_limited").Inc()
		w.Header().Set("Retry-After", "1")
		writeJSON(w, 429, map[string]string{"error": "rate limited"})
		return
	}
	res, err := s.Store.Transfer(r.Context(), req)
	s.latency.Observe(time.Since(start).Seconds())
	rid, _ := r.Context().Value(ctxKey{}).(string)
	switch {
	case err == nil && res.Replayed:
		s.transfers.WithLabelValues("replayed").Inc()
		writeJSON(w, 200, res)
	case err == nil:
		s.transfers.WithLabelValues("ok").Inc()
		writeJSON(w, 201, res)
	case errors.Is(err, store.ErrInsufficient):
		s.transfers.WithLabelValues("insufficient").Inc()
		writeJSON(w, 422, map[string]string{"error": "insufficient funds"})
	case errors.Is(err, store.ErrKeyReuse):
		s.transfers.WithLabelValues("key_reuse").Inc()
		writeJSON(w, 409, map[string]string{"error": err.Error()})
	case errors.Is(err, store.ErrNoAccount), errors.Is(err, domain.ErrUnbalanced):
		s.transfers.WithLabelValues("invalid").Inc()
		writeJSON(w, 404, map[string]string{"error": "unknown account"})
	default:
		s.transfers.WithLabelValues("error").Inc()
		s.Log.Error("transfer failed", "request_id", rid, "key", req.Key, "err", err) // details go to the log only
		writeJSON(w, 500, map[string]string{"error": "internal error"})
		return
	}
	s.Log.Info("transfer", "request_id", rid, "key", req.Key, "from", req.From, "to", req.To, "amount", req.Amount)
}

func (s *Server) balance(w http.ResponseWriter, r *http.Request) {
	b, err := s.Store.Balance(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNoAccount) {
		writeJSON(w, 404, map[string]string{"error": "unknown account"})
		return
	}
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, 200, map[string]int64{"balance": b})
}

// Limits is a token bucket per account, so one noisy payer can exhaust only itself.
type Limits struct {
	mu   sync.Mutex
	rate rate.Limit
	burs int
	m    map[string]*rate.Limiter
}

func NewLimits(perSec float64, burst int) *Limits {
	return &Limits{rate: rate.Limit(perSec), burs: burst, m: map[string]*rate.Limiter{}}
}

func (l *Limits) Allow(acct string) bool {
	l.mu.Lock()
	lim, ok := l.m[acct]
	if !ok {
		lim = rate.NewLimiter(l.rate, l.burs)
		l.m[acct] = lim
	}
	l.mu.Unlock()
	return lim.Allow()
}
