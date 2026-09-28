package acl

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrForbidden   = errors.New("forbidden")
	ErrNoAuthority = errors.New("caller lacks grant authority on resource")
	ErrEscalate    = errors.New("cannot grant a role above your own")
)

// SetPasswordVuln checks the caller's ROLE only.
func (s *Store) SetPasswordVuln(ctx context.Context, p Principal, target, hash string) error {
	if p.Role != "admin" {
		return ErrForbidden
	}
	_, err := s.Pool.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, target, hash)
	return err
}

// SetPasswordSafe requires ownership AND the current password.
func (s *Store) SetPasswordSafe(ctx context.Context, p Principal, target, oldHash, newHash string) error {
	if p.UserID != target {
		return ErrForbidden
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE users SET password_hash = $3 WHERE id = $1 AND password_hash = $2`, target, oldHash, newHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrForbidden
	}
	return nil
}

var rank = map[string]int{"viewer": 1, "editor": 2, "owner": 3}

// Grant lets caller give target a role on resource. The check and the write share
// one transaction and the caller's own row is locked, so a concurrent revoke can't slip between them.
func (s *Store) Grant(ctx context.Context, caller, target, resource, role string) error {
	if rank[role] == 0 {
		return ErrForbidden
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var callerRole string
	err = tx.QueryRow(ctx,
		`SELECT role FROM grants WHERE resource = $1 AND user_id = $2 FOR SHARE`, resource, caller).Scan(&callerRole)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && rank[callerRole] < rank["owner"]) {
		return ErrNoAuthority
	}
	if err != nil {
		return err
	}
	if rank[role] > rank[callerRole] {
		return ErrEscalate
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO grants (resource, user_id, role) VALUES ($1,$2,$3)
		 ON CONFLICT (resource, user_id) DO UPDATE SET role = EXCLUDED.role`, resource, target, role)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Decision is default-deny: Allow appears only for an explicit (role, action) pair.
type Decision bool

func Authorize(role, action string) Decision {
	switch role + ":" + action {
	case "admin:read", "admin:write", "initiator:read", "initiator:write", "viewer:read":
		return true
	}
	return false
}
