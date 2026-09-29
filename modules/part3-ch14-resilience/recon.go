package resil

import (
	"context"
	"fmt"
	"sort"
)

// Line is one row of the external statement (say, the bank's file for the day).
type Line struct {
	Key    string
	Amount int64
}

type Finding struct {
	Key    string
	Kind   string // "missing_in_ledger", "missing_in_statement", "amount_mismatch"
	Ledger int64
	Bank   int64
}

const Suspense = 999

// Reconcile compares posted payments with the statement and returns every difference.
func (s *Store) Reconcile(ctx context.Context, statement []Line) ([]Finding, error) {
	// A payment's effective amount is what was booked plus any corrections that point at it.
	rows, err := s.Pool.Query(ctx, `
		SELECT p.key, p.amount + COALESCE((SELECT sum(CASE WHEN c.to_acct = $1 THEN -c.amount ELSE c.amount END)
		                                     FROM payments c WHERE c.ref = p.key AND c.status = 'posted'), 0)
		  FROM payments p WHERE p.status = 'posted' AND p.ref IS NULL`, Suspense)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ledger := map[string]int64{}
	for rows.Next() {
		var k string
		var a int64
		if err := rows.Scan(&k, &a); err != nil {
			return nil, err
		}
		ledger[k] = a
	}
	bank := map[string]int64{}
	for _, l := range statement {
		bank[l.Key] = l.Amount
	}
	var out []Finding
	for k, a := range ledger {
		b, ok := bank[k]
		switch {
		case !ok:
			out = append(out, Finding{k, "missing_in_statement", a, 0})
		case a != b:
			out = append(out, Finding{k, "amount_mismatch", a, b})
		}
	}
	for k, b := range bank {
		if _, ok := ledger[k]; !ok {
			out = append(out, Finding{k, "missing_in_ledger", 0, b})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out, rows.Err()
}

// Correct books each mismatch as a new payment through the suspense account. The correction's key is derived
// from the day and the finding, so running the job twice books each correction once.
// Nothing is edited or deleted: the original payment stays exactly as it was.
func (s *Store) Correct(ctx context.Context, day string, fs []Finding) (booked int, err error) {
	for _, f := range fs {
		if f.Kind != "amount_mismatch" {
			continue // the other kinds need a human: a payment we don't know about, or one the bank never saw
		}
		diff := f.Bank - f.Ledger // >0: the bank moved more than we booked
		from, to, amt := Suspense, 1, diff
		if diff < 0 {
			from, to, amt = 1, Suspense, -diff
		}
		key := fmt.Sprintf("recon:%s:%s", day, f.Key)
		tx, err := s.Pool.Begin(ctx)
		if err != nil {
			return booked, err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO payments (key, from_acct, to_acct, amount, status, ref)
		                          VALUES ($1,$2,$3,$4,'posted',$5) ON CONFLICT (key) DO NOTHING`, key, from, to, amt, f.Key)
		if err == nil && tag.RowsAffected() == 1 {
			_, err = tx.Exec(ctx, `INSERT INTO entries (payment_key, account_id, amount) VALUES ($1,$2,$3),($1,$4,$5)`,
				key, from, -amt, to, amt)
		}
		if err != nil {
			tx.Rollback(ctx)
			return booked, err
		}
		if err = tx.Commit(ctx); err != nil {
			return booked, err
		}
		if tag.RowsAffected() == 1 {
			booked++
		}
	}
	return booked, nil
}
