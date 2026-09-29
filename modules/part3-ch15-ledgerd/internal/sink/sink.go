// Package sink is the event consumer: it builds a read model of balances from transfer events.
// Delivery is at-least-once, so it remembers which event ids it has already applied.
package sink

import (
	"encoding/json"
	"net/http"
	"sync"
)

type Sink struct {
	mu       sync.Mutex
	seen     map[string]bool
	Balances map[string]int64
	Received int
	Dups     int
}

func New() *Sink { return &Sink{seen: map[string]bool{}, Balances: map[string]int64{}} }

func (s *Sink) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /events", func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Event-ID")
		var ev struct {
			From   string `json:"from"`
			To     string `json:"to"`
			Amount int64  `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&ev); err != nil || id == "" {
			http.Error(w, "bad event", 400)
			return
		}
		s.mu.Lock()
		s.Received++
		if s.seen[id] {
			s.Dups++ // already applied: acknowledge without applying twice
		} else {
			s.seen[id] = true
			s.Balances[ev.From] -= ev.Amount
			s.Balances[ev.To] += ev.Amount
		}
		s.mu.Unlock()
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /state", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"received": s.Received, "duplicates": s.Dups, "distinct": len(s.seen), "balances": s.Balances})
	})
	return mux
}

func (s *Sink) State() (received, dups, distinct int, balances map[string]int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := map[string]int64{}
	for k, v := range s.Balances {
		b[k] = v
	}
	return s.Received, s.Dups, len(s.seen), b
}
