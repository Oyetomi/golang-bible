package resil

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Config struct {
	Limiter   *PerAccount // nil = no rate limit
	GlobalKey bool        // true: one shared bucket instead of one per account
	Fraud     interface {
		Check(context.Context, PayReq) (Verdict, error)
	}
	Breaker    *Breaker
	Policy     Policy
	SmallLimit int64
}

func (s *Store) Handler(c Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("POST /pay", func(w http.ResponseWriter, r *http.Request) {
		var req PayReq
		if json.NewDecoder(r.Body).Decode(&req) != nil || req.Key == "" || req.Amount <= 0 {
			http.Error(w, "bad request", 400)
			return
		}
		if c.Limiter != nil {
			key := req.From
			if c.GlobalKey {
				key = 0
			}
			if !c.Limiter.Allow(key) {
				w.Header().Set("Retry-After", "1")
				http.Error(w, "rate limited", 429)
				return
			}
		}
		status := "posted"
		if c.Fraud != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			allow, held, reason := Screen(ctx, c.Fraud, c.Breaker, c.Policy, c.SmallLimit, req)
			cancel()
			if !allow {
				http.Error(w, reason, 402)
				return
			}
			if held {
				status = "held"
			}
		}
		st, err := s.Pay(r.Context(), req, status)
		if err != nil {
			http.Error(w, "error", 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": st})
	})
	return mux
}
