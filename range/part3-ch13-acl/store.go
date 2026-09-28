package acl

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Account struct {
	ID       int64  `json:"id"`
	TenantID string `json:"tenant_id"`
	OwnerID  string `json:"owner_id"`
	Balance  int64  `json:"balance"`
	Memo     string `json:"memo,omitempty"`
}

type Principal struct {
	UserID   string
	TenantID string
	Role     string
}

type Store struct{ Pool *pgxpool.Pool }

// ---- v0: the id alone picks the row -------------------------------------

func (s *Store) AccountByID(ctx context.Context, id int64) (Account, error) {
	var a Account
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, owner_id, balance, memo FROM accounts WHERE id = $1`, id,
	).Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Balance, &a.Memo)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// ---- v1: the caller is part of the lookup -------------------------------

func (s *Store) AccountFor(ctx context.Context, p Principal, id int64) (Account, error) {
	var a Account
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, owner_id, balance, memo FROM accounts
		  WHERE id = $1 AND tenant_id = $2 AND owner_id = $3`, id, p.TenantID, p.UserID,
	).Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Balance, &a.Memo)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

func (s *Store) ListAll(ctx context.Context) ([]Account, error) {
	return s.list(ctx, `SELECT id, tenant_id, owner_id, balance, memo FROM accounts ORDER BY id`)
}

func (s *Store) ListFor(ctx context.Context, p Principal) ([]Account, error) {
	return s.list(ctx, `SELECT id, tenant_id, owner_id, balance, memo FROM accounts
	                     WHERE tenant_id = $1 AND owner_id = $2 ORDER BY id`, p.TenantID, p.UserID)
}

func (s *Store) list(ctx context.Context, q string, args ...any) ([]Account, error) {
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Account
	for rows.Next() {
		var a Account
		if err := rows.Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Balance, &a.Memo); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Credit adds amount to an account inside the tenant the caller belongs to.
func (s *Store) Credit(ctx context.Context, tenant string, id, amount int64) (int64, error) {
	var n int64
	err := s.Pool.QueryRow(ctx,
		`UPDATE accounts SET balance = balance + $3 WHERE id = $1 AND tenant_id = $2 RETURNING balance`,
		id, tenant, amount).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	return n, err
}

// CountByIDConcat builds SQL by string concatenation. Never do this.
func (s *Store) CountByIDConcat(ctx context.Context, id string) (int, error) {
	rows, err := s.Pool.Query(ctx, "SELECT id FROM accounts WHERE id = "+id)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		n++
	}
	return n, rows.Err()
}
