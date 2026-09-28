package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const dsn = "postgres://abbey@127.0.0.1:55432/ledgerd"

func newStore(t *testing.T) *Store {
	t.Helper()
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dsn)
	cfg.MaxConns = 32
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	pool.Exec(ctx, `TRUNCATE outbox, idempotency_keys, postings, transactions, accounts RESTART IDENTITY CASCADE`)
	pool.Exec(ctx, `INSERT INTO accounts (id,currency,kind) VALUES ('treasury','USD','system')`)
	pool.Exec(ctx, `INSERT INTO accounts (id,currency,kind) SELECT 'acct-'||g,'USD','customer' FROM generate_series(1,20) g`)
	s := &Store{Pool: pool}
	for i := 1; i <= 20; i++ { // fund every customer account with $1,000.00
		if _, err := s.Transfer(ctx, TransferReq{Key: fmt.Sprintf("fund-%d", i), From: "treasury", To: fmt.Sprintf("acct-%d", i), Amount: 100000}); err != nil {
			t.Fatal(err)
		}
	}
	return s
}

func TestOverdraftAndIdempotency(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	_, err := s.Transfer(ctx, TransferReq{Key: "big", From: "acct-1", To: "acct-2", Amount: 100001})
	t.Logf("transfer of $1,000.01 from an account holding $1,000.00: %v", err)
	if !errors.Is(err, ErrInsufficient) {
		t.Fatal("overdraft allowed")
	}
	r1, _ := s.Transfer(ctx, TransferReq{Key: "k1", From: "acct-1", To: "acct-2", Amount: 500})
	r2, _ := s.Transfer(ctx, TransferReq{Key: "k1", From: "acct-1", To: "acct-2", Amount: 500})
	_, err3 := s.Transfer(ctx, TransferReq{Key: "k1", From: "acct-1", To: "acct-2", Amount: 900})
	b1, _ := s.Balance(ctx, "acct-1")
	t.Logf("same key twice: tx %d then tx %d (replayed=%v); balance of acct-1 = %d; same key, different amount: %v", r1.TransactionID, r2.TransactionID, r2.Replayed, b1, err3)
	if !r2.Replayed || b1 != 99500 || !errors.Is(err3, ErrKeyReuse) {
		t.Fatal("idempotency broken")
	}
	// ten concurrent requests with one key
	var wg sync.WaitGroup
	var replays atomic.Int64
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := s.Transfer(ctx, TransferReq{Key: "race", From: "acct-3", To: "acct-4", Amount: 700})
			if err != nil {
				t.Error(err)
			}
			if r.Replayed {
				replays.Add(1)
			}
		}()
	}
	wg.Wait()
	b3, _ := s.Balance(ctx, "acct-3")
	t.Logf("10 concurrent requests, one key: %d replayed, balance of acct-3 = %d (one transfer of 700 applied)", replays.Load(), b3)
	if b3 != 99300 {
		t.Fatal("applied more than once")
	}
}

// run fires opposite-direction transfers between two accounts from many goroutines.
func opposite(s *Store, window time.Duration) (ok, deadlocks int64) {
	var wg sync.WaitGroup
	var d, o atomic.Int64
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			stop := time.Now().Add(window)
			for i := 0; time.Now().Before(stop); i++ {
				from, to := "acct-5", "acct-6"
				if (w+i)%2 == 0 {
					from, to = to, from
				}
				_, err := s.Transfer(context.Background(), TransferReq{Key: fmt.Sprintf("d-%p-%d-%d", s, w, i), From: from, To: to, Amount: 1})
				var pg *pgconn.PgError
				switch {
				case err == nil:
					o.Add(1)
				case errors.As(err, &pg) && pg.Code == "40P01":
					d.Add(1)
				}
			}
		}(w)
	}
	wg.Wait()
	return o.Load(), d.Load()
}

func TestDeadlockOrdering(t *testing.T) {
	s := newStore(t)
	s.UnorderedLocks = true
	ok, dl := opposite(s, 4*time.Second)
	t.Logf("4 s window, locks taken in from/to order: %d transfers ok, %d deadlocks (Postgres aborted them)", ok, dl)
	s.UnorderedLocks = false
	ok2, dl2 := opposite(s, 4*time.Second)
	t.Logf("4 s window, locks taken in id order:      %d transfers ok, %d deadlocks", ok2, dl2)
	if dl2 != 0 {
		t.Fatal("ordered locking deadlocked")
	}
}

func TestConcurrentBooksBalance(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	const workers, per = 64, 300
	var wg sync.WaitGroup
	var okN, insuf atomic.Int64
	start := time.Now()
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(w), 7))
			for i := 0; i < per; i++ {
				a, b := 1+r.IntN(20), 1+r.IntN(20)
				if a == b {
					continue
				}
				_, err := s.Transfer(ctx, TransferReq{Key: fmt.Sprintf("c-%d-%d", w, i), From: fmt.Sprintf("acct-%d", a), To: fmt.Sprintf("acct-%d", b), Amount: int64(1 + r.IntN(60000))})
				switch {
				case err == nil:
					okN.Add(1)
				case errors.Is(err, ErrInsufficient):
					insuf.Add(1)
				default:
					t.Error(err)
				}
			}
		}(w)
	}
	wg.Wait()
	el := time.Since(start)
	total, unbalanced, drift, err := s.Check(ctx)
	var neg int
	s.Pool.QueryRow(ctx, `SELECT count(*) FROM accounts WHERE kind='customer' AND balance < 0`).Scan(&neg)
	t.Logf("%d workers x %d attempts: %d transfers applied, %d refused for insufficient funds, %.0f transfers/s", workers, per, okN.Load(), insuf.Load(), float64(okN.Load())/el.Seconds())
	t.Logf("postings sum=%d, unbalanced transactions=%d, cached-balance drift=%d, customer accounts below zero=%d, err=%v", total, unbalanced, drift, neg, err)
	if total != 0 || unbalanced != 0 || drift != 0 || neg != 0 {
		t.Fatal("books do not balance")
	}
}
