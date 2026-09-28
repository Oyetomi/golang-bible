package resil

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PayReq struct {
	Key    string `json:"key"`
	From   int    `json:"from"`
	To     int    `json:"to"`
	Amount int64  `json:"amount"`
}

type Store struct{ Pool *pgxpool.Pool }

// Pay records a payment as two entries that sum to zero. The key makes it idempotent:
// a repeat returns the stored status instead of moving money twice.
func (s *Store) Pay(ctx context.Context, r PayReq, status string) (string, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx,
		`INSERT INTO payments (key, from_acct, to_acct, amount, status) VALUES ($1,$2,$3,$4,$5)`,
		r.Key, r.From, r.To, r.Amount, status)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" { // duplicate key: seen before
		tx.Rollback(ctx)
		var prev string
		if err := s.Pool.QueryRow(ctx, `SELECT status FROM payments WHERE key=$1`, r.Key).Scan(&prev); err != nil {
			return "", err
		}
		return prev, nil
	}
	if err != nil {
		return "", err
	}
	if status == "posted" {
		if _, err := tx.Exec(ctx,
			`INSERT INTO entries (payment_key, account_id, amount) VALUES ($1,$2,$3),($1,$4,$5)`,
			r.Key, r.From, -r.Amount, r.To, r.Amount); err != nil {
			return "", err
		}
	}
	return status, tx.Commit(ctx)
}

// Invariants returns (sum of all entries, payments with a non-zero sum, payments posted without entries).
func (s *Store) Invariants(ctx context.Context) (total int64, unbalanced, missing int, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT COALESCE(sum(amount),0) FROM entries`).Scan(&total)
	if err != nil {
		return
	}
	err = s.Pool.QueryRow(ctx, `SELECT count(*) FROM (SELECT payment_key FROM entries GROUP BY 1 HAVING sum(amount) <> 0) x`).Scan(&unbalanced)
	if err != nil {
		return
	}
	err = s.Pool.QueryRow(ctx, `SELECT count(*) FROM payments p WHERE status='posted' AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.payment_key=p.key)`).Scan(&missing)
	return
}

var _ = pgx.ErrNoRows

// ReleaseHeld re-screens payments that were held while fraud was down. Approved ones are posted:
// the status change and the two entries commit together, and a payment can be released only once.
func (s *Store) ReleaseHeld(ctx context.Context, check func(context.Context, PayReq) (Verdict, error)) (released, stillHeld int, err error) {
	rows, err := s.Pool.Query(ctx, `SELECT key, from_acct, to_acct, amount FROM payments WHERE status='held' ORDER BY created_at`)
	if err != nil {
		return 0, 0, err
	}
	var held []PayReq
	for rows.Next() {
		var r PayReq
		if err := rows.Scan(&r.Key, &r.From, &r.To, &r.Amount); err != nil {
			rows.Close()
			return 0, 0, err
		}
		held = append(held, r)
	}
	rows.Close()
	for _, r := range held {
		v, cerr := check(ctx, r)
		if cerr != nil || !v.Allow {
			stillHeld++
			continue
		}
		tx, err := s.Pool.Begin(ctx)
		if err != nil {
			return released, stillHeld, err
		}
		tag, err := tx.Exec(ctx, `UPDATE payments SET status='posted' WHERE key=$1 AND status='held'`, r.Key)
		if err == nil && tag.RowsAffected() == 1 {
			_, err = tx.Exec(ctx, `INSERT INTO entries (payment_key, account_id, amount) VALUES ($1,$2,$3),($1,$4,$5)`,
				r.Key, r.From, -r.Amount, r.To, r.Amount)
		}
		if err != nil {
			tx.Rollback(ctx)
			return released, stillHeld, err
		}
		if err := tx.Commit(ctx); err != nil {
			return released, stillHeld, err
		}
		if tag.RowsAffected() == 1 {
			released++
		}
	}
	return released, stillHeld, nil
}
