package resil

import (
	"runtime"
	"testing"
	"time"
)

func heap() uint64 {
	runtime.GC()
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m.HeapAlloc
}

func TestLimiterMemory(t *testing.T) {
	base := heap()
	p := NewPerAccount(10, 5)
	for i := 0; i < 1_000_000; i++ {
		p.Allow(i)
	}
	full := heap()
	t.Logf("1,000,000 accounts seen: %d buckets, %.0f MB of heap (%.0f bytes per bucket)", p.Len(), float64(full-base)/1e6, float64(full-base)/1e6)
	time.Sleep(50 * time.Millisecond)
	n := p.Sweep(10 * time.Millisecond)
	after := heap()
	t.Logf("Sweep(10ms) removed %d; %d buckets left; heap back to %.0f MB above baseline", n, p.Len(), float64(after-base)/1e6)
}

func TestPerAccountIsolation(t *testing.T) {
	p := NewPerAccount(10, 5)
	botOK := 0
	for i := 0; i < 1000; i++ {
		if p.Allow(7) {
			botOK++
		}
	}
	t.Logf("account 7 fired 1000 times in a burst: %d allowed (burst is 5)", botOK)
	if !p.Allow(8) {
		t.Fatal("account 8 was affected by account 7")
	}
	t.Log("account 8's first request: allowed")
}
