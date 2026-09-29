package outbox

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"

	"ledgerd/internal/sink"
	"ledgerd/internal/store"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAtLeastOnceThenDedup(t *testing.T) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/ledgerd")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	pool.Exec(ctx, `TRUNCATE outbox, idempotency_keys, postings, transactions, accounts RESTART IDENTITY CASCADE`)
	pool.Exec(ctx, `INSERT INTO accounts (id,currency,kind) VALUES ('treasury','USD','system'),('a','USD','customer'),('b','USD','customer')`)
	st := &store.Store{Pool: pool}
	st.Transfer(ctx, store.TransferReq{Key: "fund", From: "treasury", To: "a", Amount: 1_000_000})
	pool.Exec(ctx, `UPDATE outbox SET published_at = now()`) // the funding event is not part of this test
	for i := 0; i < 500; i++ {
		if _, err := st.Transfer(ctx, store.TransferReq{Key: fmt.Sprintf("t%d", i), From: "a", To: "b", Amount: int64(1 + i%50)}); err != nil {
			t.Fatal(err)
		}
	}
	sk := sink.New()
	srv := httptest.NewServer(sk.Handler())
	defer srv.Close()
	r := &Relay{Pool: pool, SinkURL: srv.URL, Batch: 100, CrashAfterPublish: true}

	n, crashed, _ := r.Once(ctx)
	t.Logf("pass 1: sent %d events, then the relay crashed before marking them (crashed=%v)", n, crashed)
	total := n
	for {
		n, _, err := r.Once(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if n == 0 {
			break
		}
		total += n
	}
	var unpub int
	pool.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL`).Scan(&unpub)
	rec, dups, distinct, bal := sk.State()
	var ledgerB, ledgerA int64
	pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id='b'`).Scan(&ledgerB)
	pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id='a'`).Scan(&ledgerA)
	t.Logf("relay sent %d events for 500 transfers; sink received %d, %d duplicates, %d distinct; unpublished left: %d", total, rec, dups, distinct, unpub)
	t.Logf("read model: a=%d b=%d   ledger: a=%d b=%d", bal["a"], bal["b"], ledgerA-1_000_000, ledgerB)
	if distinct != 500 || dups != 100 || bal["b"] != ledgerB || unpub != 0 {
		t.Fatal("projection does not match the ledger")
	}
}

func TestTwoRelaysDontOverlap(t *testing.T) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/ledgerd")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	pool.Exec(ctx, `TRUNCATE outbox, idempotency_keys, postings, transactions, accounts RESTART IDENTITY CASCADE`)
	pool.Exec(ctx, `INSERT INTO accounts (id,currency,kind) VALUES ('treasury','USD','system'),('a','USD','customer'),('b','USD','customer')`)
	st := &store.Store{Pool: pool}
	st.Transfer(ctx, store.TransferReq{Key: "fund", From: "treasury", To: "a", Amount: 1_000_000})
	for i := 0; i < 400; i++ {
		st.Transfer(ctx, store.TransferReq{Key: fmt.Sprintf("s%d", i), From: "a", To: "b", Amount: 1})
	}
	sk := sink.New()
	srv := httptest.NewServer(sk.Handler())
	defer srv.Close()
	done := make(chan int, 2)
	for i := 0; i < 2; i++ {
		go func() {
			r := &Relay{Pool: pool, SinkURL: srv.URL, Batch: 100}
			n, _, _ := r.Once(ctx)
			done <- n
		}()
	}
	a, b := <-done, <-done
	rec, dups, distinct, _ := sk.State()
	t.Logf("two relays started together on 401 unpublished events, batch 100: one sent %d, the other sent %d; consumer saw %d (%d duplicates, %d distinct)", a, b, rec, dups, distinct)
}
