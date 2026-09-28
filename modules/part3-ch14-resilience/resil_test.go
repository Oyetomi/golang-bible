package resil

import (
	"context"
	"fmt"
	"math/rand/v2"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "postgres://abbey@127.0.0.1:55432/resil")
	if err != nil {
		t.Fatal(err)
	}
	pool.Exec(context.Background(), "TRUNCATE entries, payments")
	t.Cleanup(pool.Close)
	return &Store{Pool: pool}
}

func TestIdempotentAndBalanced(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	var wg sync.WaitGroup
	var mu sync.Mutex
	sent := 0
	for w := 0; w < 32; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(w), 1))
			for i := 0; i < 500; i++ {
				k := r.IntN(4000) // many workers reuse the same keys: retries and duplicates
				req := PayReq{Key: fmt.Sprintf("k%d", k), From: 1 + r.IntN(900), To: 1 + r.IntN(900), Amount: int64(1 + r.IntN(9999))}
				if req.From == req.To {
					req.To++
				}
				if _, err := s.Pay(ctx, req, "posted"); err != nil {
					t.Error(err)
					return
				}
				mu.Lock()
				sent++
				mu.Unlock()
			}
		}(w)
	}
	wg.Wait()
	var payments int
	s.Pool.QueryRow(ctx, `SELECT count(*) FROM payments`).Scan(&payments)
	total, unbalanced, missing, _ := s.Invariants(ctx)
	t.Logf("requests sent: %d, distinct keys stored: %d, entries sum: %d, unbalanced payments: %d, posted-without-entries: %d", sent, payments, total, unbalanced, missing)
	if total != 0 || unbalanced != 0 || missing != 0 {
		t.Fatal("ledger invariant broken")
	}
}

func TestReconcile(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	var stmt []Line
	for i := 0; i < 1000; i++ {
		k := fmt.Sprintf("p%04d", i)
		amt := int64(1000 + i)
		s.Pay(ctx, PayReq{Key: k, From: 1 + i%500, To: 501 + i%400, Amount: amt}, "posted")
		stmt = append(stmt, Line{k, amt})
	}
	stmt[41].Amount += 12                    // the bank moved 12 cents more than we booked
	stmt = append(stmt[:100], stmt[101:]...) // the bank has no line for p0100
	stmt = append(stmt, Line{"p9999", 4242}) // the bank has a payment we never saw
	fs, _ := s.Reconcile(ctx, stmt)
	for _, f := range fs {
		t.Logf("finding: %-22s %s ledger=%d bank=%d", f.Kind, f.Key, f.Ledger, f.Bank)
	}
	n1, _ := s.Correct(ctx, "2026-09-28", fs)
	n2, _ := s.Correct(ctx, "2026-09-28", fs)
	total, unbalanced, _, _ := s.Invariants(ctx)
	fs2, _ := s.Reconcile(ctx, stmt)
	t.Logf("corrections booked: first run %d, second run %d; entries sum %d, unbalanced %d; findings after: %d", n1, n2, total, unbalanced, len(fs2))
}
