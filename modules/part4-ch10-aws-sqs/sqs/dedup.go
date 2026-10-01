package sqs

import (
	"bufio"
	"os"
	"sync"
)

// Dedup is an idempotency set keyed by payment_id, persisted to a file so it
// survives a restart. A real ledger would use a unique constraint in the same
// database transaction as the balance change (Postgres INSERT ... ON CONFLICT
// DO NOTHING), or a DynamoDB conditional PutItem: the dedup record and the
// effect must commit atomically, which a file cannot give you.
type Dedup struct {
	mu       sync.Mutex
	done     map[string]bool
	inflight map[string]bool
	f        *os.File
}

// OpenDedup loads the set from path (created if missing).
func OpenDedup(path string) (*Dedup, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0o644)
	if err != nil {
		return nil, err
	}
	d := &Dedup{done: map[string]bool{}, inflight: map[string]bool{}, f: f}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		d.done[sc.Text()] = true
	}
	return d, nil
}

// Begin claims key. It returns false if the key is already done or being
// processed by another goroutine: the caller must skip the side effect.
func (d *Dedup) Begin(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.done[key] || d.inflight[key] {
		return false
	}
	d.inflight[key] = true
	return true
}

// Done records a successful effect.
func (d *Dedup) Done(key string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.inflight, key)
	d.done[key] = true
	d.f.WriteString(key + "\n")
}

// Abort releases a claim after a failure so a redelivery can retry.
func (d *Dedup) Abort(key string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.inflight, key)
}

// Seen reports whether key completed.
func (d *Dedup) Seen(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.done[key]
}

func (d *Dedup) Close() error { return d.f.Close() }
