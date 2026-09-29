// Package store is the Postgres adapter: one transaction per transfer.
package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"ledgerd/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInsufficient = errors.New("insufficient funds")
	ErrNoAccount    = errors.New("unknown account")
	ErrKeyReuse     = errors.New("idempotency key reused with a different request")
)

type TransferReq struct {
	Key    string `json:"key"`
	From   string `json:"from"`
	To     string `json:"to"`
	Amount int64  `json:"amount"`
}

type TransferResult struct {
	TransactionID int64 `json:"transaction_id"`
	Replayed      bool  `json:"replayed"`
}

type Store struct {
	Pool *pgxpool.Pool
	// UnorderedLocks makes Transfer lock the "from" account before the "to" account instead of in
	// a fixed order. It exists to show the deadlock that ordering prevents; never set it in production.
	UnorderedLocks bool
}

func hash(r TransferReq) string {
	b, _ := json.Marshal([]any{r.From, r.To, r.Amount})
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// Transfer moves money in one transaction: claim the idempotency key, lock both accounts,
// check the funds, write the transaction, its postings, the new balances and the outbox event.
func (s *Store) Transfer(ctx context.Context, r TransferReq) (TransferResult, error) {
	tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return TransferResult{}, err
	}
	defer tx.Rollback(ctx)

	// 1. Has this key been used? A duplicate returns the first result without touching the accounts.
	var existing int64
	var prevHash string
	err = tx.QueryRow(ctx, `SELECT transaction_id, request_hash FROM idempotency_keys WHERE key = $1`, r.Key).Scan(&existing, &prevHash)
	if err == nil {
		if prevHash != hash(r) {
			return TransferResult{}, ErrKeyReuse
		}
		return TransferResult{TransactionID: existing, Replayed: true}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return TransferResult{}, err
	}

	// 2. Lock both accounts. Always in id order, so two opposite transfers cannot each hold one lock
	//    and wait for the other.
	ids := []string{r.From, r.To}
	if !s.UnorderedLocks {
		sort.Strings(ids)
	}
	bal := map[string]int64{}
	kind := map[string]string{}
	for _, id := range ids {
		var b int64
		var k string
		if err := tx.QueryRow(ctx, `SELECT balance, kind FROM accounts WHERE id = $1 FOR UPDATE`, id).Scan(&b, &k); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return TransferResult{}, fmt.Errorf("%w: %s", ErrNoAccount, id)
			}
			return TransferResult{}, err
		}
		bal[id], kind[id] = b, k
	}

	// 3. Look again now that we hold the locks: a concurrent request with the same key may have
	//    committed while we waited, and it may have spent the money we were about to check.
	err = tx.QueryRow(ctx, `SELECT transaction_id, request_hash FROM idempotency_keys WHERE key = $1`, r.Key).Scan(&existing, &prevHash)
	if err == nil {
		if prevHash != hash(r) {
			return TransferResult{}, ErrKeyReuse
		}
		return TransferResult{TransactionID: existing, Replayed: true}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return TransferResult{}, err
	}

	// 4. Rules.
	t, err := domain.Transfer(r.From, r.To, domain.Money{Minor: r.Amount, Currency: "USD"}, "transfer "+r.Key)
	if err != nil {
		return TransferResult{}, err
	}
	if err := t.Validate(); err != nil {
		return TransferResult{}, err
	}
	if kind[r.From] == "customer" && bal[r.From] < r.Amount {
		return TransferResult{}, ErrInsufficient
	}

	// 5. Write.
	var txID int64
	if err := tx.QueryRow(ctx, `INSERT INTO transactions (memo) VALUES ($1) RETURNING id`, t.Memo).Scan(&txID); err != nil {
		return TransferResult{}, err
	}
	for _, p := range t.Postings {
		if _, err := tx.Exec(ctx, `INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1,$2,$3)`, txID, p.Account, p.Amount); err != nil {
			return TransferResult{}, err
		}
		if _, err := tx.Exec(ctx, `UPDATE accounts SET balance = balance + $2 WHERE id = $1`, p.Account, p.Amount); err != nil {
			return TransferResult{}, err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO idempotency_keys (key, request_hash, transaction_id) VALUES ($1,$2,$3)`, r.Key, hash(r), txID); err != nil {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" { // a concurrent request with the same key won the race
			tx.Rollback(ctx)
			return s.replay(ctx, r)
		}
		return TransferResult{}, err
	}
	ev, _ := json.Marshal(map[string]any{"transaction_id": txID, "from": r.From, "to": r.To, "amount": r.Amount})
	if _, err := tx.Exec(ctx, `INSERT INTO outbox (topic, payload) VALUES ('transfer.completed', $1)`, ev); err != nil {
		return TransferResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return TransferResult{}, err
	}
	return TransferResult{TransactionID: txID}, nil
}

func (s *Store) replay(ctx context.Context, r TransferReq) (TransferResult, error) {
	var id int64
	var h string
	if err := s.Pool.QueryRow(ctx, `SELECT transaction_id, request_hash FROM idempotency_keys WHERE key=$1`, r.Key).Scan(&id, &h); err != nil {
		return TransferResult{}, err
	}
	if h != hash(r) {
		return TransferResult{}, ErrKeyReuse
	}
	return TransferResult{TransactionID: id, Replayed: true}, nil
}

func (s *Store) Balance(ctx context.Context, id string) (int64, error) {
	var b int64
	err := s.Pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id=$1`, id).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNoAccount
	}
	return b, err
}

// Check runs the three questions that prove the books: postings sum to zero, every transaction
// sums to zero, and each cached balance equals the sum of its postings.
func (s *Store) Check(ctx context.Context) (total int64, unbalanced, cacheDrift int, err error) {
	if err = s.Pool.QueryRow(ctx, `SELECT COALESCE(sum(amount),0) FROM postings`).Scan(&total); err != nil {
		return
	}
	if err = s.Pool.QueryRow(ctx, `SELECT count(*) FROM (SELECT 1 FROM postings GROUP BY transaction_id HAVING sum(amount) <> 0) x`).Scan(&unbalanced); err != nil {
		return
	}
	err = s.Pool.QueryRow(ctx, `SELECT count(*) FROM accounts a WHERE a.balance <> COALESCE((SELECT sum(amount) FROM postings p WHERE p.account_id = a.id),0)`).Scan(&cacheDrift)
	return
}
