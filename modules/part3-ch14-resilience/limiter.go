package resil

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// PerAccount gives every account its own token bucket, so one noisy account
// can exhaust only itself. Idle buckets are swept so the map cannot grow forever.
type PerAccount struct {
	mu      sync.Mutex
	limit   rate.Limit
	burst   int
	buckets map[int]*entry
}

type entry struct {
	l    *rate.Limiter
	last time.Time
}

func NewPerAccount(perSec float64, burst int) *PerAccount {
	return &PerAccount{limit: rate.Limit(perSec), burst: burst, buckets: map[int]*entry{}}
}

func (p *PerAccount) Allow(acct int) bool {
	p.mu.Lock()
	e, ok := p.buckets[acct]
	if !ok {
		e = &entry{l: rate.NewLimiter(p.limit, p.burst)}
		p.buckets[acct] = e
	}
	e.last = time.Now()
	p.mu.Unlock()
	return e.l.Allow()
}

// Sweep drops buckets idle for longer than ttl and returns how many it removed.
func (p *PerAccount) Sweep(ttl time.Duration) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := 0
	for k, e := range p.buckets {
		if time.Since(e.last) > ttl {
			delete(p.buckets, k)
			n++
		}
	}
	return n
}

func (p *PerAccount) Len() int { p.mu.Lock(); defer p.mu.Unlock(); return len(p.buckets) }
