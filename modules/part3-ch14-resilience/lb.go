package resil

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// LB is a small round-robin load balancer. Health checking and retrying are switches, so
// the chapter can show what each one buys.
type LB struct {
	Backends []string
	Retry    bool
	next     atomic.Uint64
	mu       sync.RWMutex
	down     map[string]bool
	client   *http.Client
}

func NewLB(backends []string, health, retry bool) *LB {
	lb := &LB{Backends: backends, Retry: retry, down: map[string]bool{},
		client: &http.Client{Timeout: 2 * time.Second, Transport: &http.Transport{MaxIdleConnsPerHost: 256}}}
	if health {
		go lb.probe()
	}
	return lb
}

func (l *LB) probe() {
	c := &http.Client{Timeout: 500 * time.Millisecond}
	for range time.Tick(200 * time.Millisecond) {
		for _, b := range l.Backends {
			resp, err := c.Get(b + "/healthz")
			ok := err == nil && resp.StatusCode == 200
			if resp != nil {
				resp.Body.Close()
			}
			l.mu.Lock()
			l.down[b] = !ok
			l.mu.Unlock()
		}
	}
}

func (l *LB) pick(skip string) string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	start := int(l.next.Add(1))
	for i := 0; i < len(l.Backends); i++ { // scan once from a rotating start
		b := l.Backends[(start+i)%len(l.Backends)]
		if !l.down[b] && b != skip {
			return b
		}
	}
	return ""
}

func (l *LB) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	tries := 1
	if l.Retry {
		tries = 2
	}
	skip := ""
	for i := 0; i < tries; i++ {
		b := l.pick(skip)
		if b == "" {
			if os.Getenv("LBDEBUG") != "" {
				log.Printf("no backend at try %d skip=%s down=%v", i, skip, l.down)
			}
			break
		}
		req, _ := http.NewRequestWithContext(r.Context(), r.Method, b+r.URL.Path, bytes.NewReader(body))
		req.Header = r.Header.Clone()
		resp, err := l.client.Do(req)
		if err != nil || resp.StatusCode >= 500 {
			if os.Getenv("LBDEBUG") != "" {
				log.Printf("try %d backend %s err=%v", i, b, err)
			}
			if resp != nil {
				resp.Body.Close()
			}
			skip = b // try the other backend next
			continue
		}
		defer resp.Body.Close()
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
		return
	}
	http.Error(w, "no backend", http.StatusBadGateway)
}
