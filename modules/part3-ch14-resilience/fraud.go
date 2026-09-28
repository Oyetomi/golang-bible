package resil

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrFraudDown = errors.New("fraud service unavailable")
	ErrBreaker   = errors.New("circuit open")
)

type Verdict struct {
	Allow  bool   `json:"allow"`
	Reason string `json:"reason"`
}

// HTTPFraud asks a remote fraud service. Every call has a deadline.
type HTTPFraud struct {
	URL     string
	Timeout time.Duration
	Client  *http.Client
}

func (f *HTTPFraud) Check(ctx context.Context, r PayReq) (Verdict, error) {
	ctx, cancel := context.WithTimeout(ctx, f.Timeout)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "POST", f.URL+"/check", strings.NewReader(`{"from":`+itoa(r.From)+`,"amount":`+itoa64(r.Amount)+`}`))
	c := f.Client
	if c == nil {
		c = http.DefaultClient
	}
	resp, err := c.Do(req)
	if err != nil {
		return Verdict{}, ErrFraudDown
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return Verdict{}, ErrFraudDown
	}
	var v Verdict
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return Verdict{}, ErrFraudDown
	}
	return v, nil
}

// Breaker stops calling a dependency that keeps failing, and probes it again after a cooldown.
type Breaker struct {
	mu        sync.Mutex
	fails     int
	threshold int
	cooldown  time.Duration
	openedAt  time.Time
	open      bool
}

func NewBreaker(threshold int, cooldown time.Duration) *Breaker {
	return &Breaker{threshold: threshold, cooldown: cooldown}
}

func (b *Breaker) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.open {
		return true
	}
	if time.Since(b.openedAt) >= b.cooldown { // half-open: let one probe through
		b.openedAt = time.Now()
		return true
	}
	return false
}

func (b *Breaker) Report(err error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if err == nil {
		b.fails, b.open = 0, false
		return
	}
	b.fails++
	if b.fails >= b.threshold {
		b.open, b.openedAt = true, time.Now()
	}
}

type Policy int

const (
	FailClosed  Policy = iota // no answer means no payment
	FailOpen                  // no answer means allow
	FailDegrade               // no answer: allow small payments, hold big ones
)

// Screen combines the breaker, the call and the policy into one decision.
// held=true means "accept now, review later".
func Screen(ctx context.Context, f interface {
	Check(context.Context, PayReq) (Verdict, error)
}, b *Breaker, pol Policy, smallLimit int64, r PayReq) (allow, held bool, reason string) {
	var v Verdict
	var err error
	if b != nil && !b.Allow() {
		err = ErrBreaker
	} else {
		v, err = f.Check(ctx, r)
		if b != nil {
			b.Report(err)
		}
	}
	if err == nil {
		return v.Allow, false, v.Reason
	}
	switch pol {
	case FailOpen:
		return true, false, "fraud unavailable: allowed"
	case FailDegrade:
		if r.Amount <= smallLimit {
			return true, false, "fraud unavailable: small payment allowed"
		}
		return true, true, "fraud unavailable: held for review"
	}
	return false, false, "fraud unavailable: declined"
}
