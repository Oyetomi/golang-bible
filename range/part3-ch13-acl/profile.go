package acl

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrFieldLocked = errors.New("field is not editable")

// The fields an update may touch. Column names come from this list, never from the request.
var profileFields = map[string]string{"first_name": "first_name", "last_name": "last_name", "email": "email", "address": "address"}

// RulesCache keeps the admin's field rules in memory so handlers don't query them on every request.
type RulesCache struct {
	mu      sync.Mutex
	rules   map[string]bool
	loaded  time.Time
	TTL     time.Duration
	Refresh func(context.Context) (map[string]bool, error)
}

func (c *RulesCache) Editable(ctx context.Context, field string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.rules == nil || time.Since(c.loaded) > c.TTL {
		if r, err := c.Refresh(ctx); err == nil {
			c.rules, c.loaded = r, time.Now()
		}
	}
	return c.rules[field]
}

func (s *Store) LoadRules(ctx context.Context) (map[string]bool, error) {
	rows, err := s.Pool.Query(ctx, `SELECT field, editable FROM field_rules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := map[string]bool{}
	for rows.Next() {
		var f string
		var e bool
		if err := rows.Scan(&f, &e); err != nil {
			return nil, err
		}
		m[f] = e
	}
	return m, rows.Err()
}

// UpdateApplyThenCheck writes every field, then looks at the rules and reports a denial.
// The caller sees an error; the data has already changed. This is the bug.
func (s *Store) UpdateApplyThenCheck(ctx context.Context, cache *RulesCache, target string, changes map[string]string) error {
	for f, v := range changes {
		col, ok := profileFields[f]
		if !ok {
			return fmt.Errorf("unknown field %q", f)
		}
		if _, err := s.Pool.Exec(ctx, `UPDATE profiles SET `+col+` = $2 WHERE user_id = $1`, target, v); err != nil {
			return err
		}
	}
	for f := range changes {
		if !cache.Editable(ctx, f) {
			return fmt.Errorf("%w: %s", ErrFieldLocked, f)
		}
	}
	return nil
}

// UpdateCachedCheck checks before writing, but against a cache that can be out of date.
func (s *Store) UpdateCachedCheck(ctx context.Context, cache *RulesCache, target string, changes map[string]string) error {
	for f := range changes {
		if !cache.Editable(ctx, f) {
			return fmt.Errorf("%w: %s", ErrFieldLocked, f)
		}
	}
	for f, v := range changes {
		if _, err := s.Pool.Exec(ctx, `UPDATE profiles SET `+profileFields[f]+` = $2 WHERE user_id = $1`, target, v); err != nil {
			return err
		}
	}
	return nil
}

// Update decides and writes in one transaction. The rules are read inside it with FOR SHARE, so an admin
// changing a rule waits for us (or we wait for them): a write can never straddle a rule change.
// Any locked, unknown or unreadable field refuses the whole request, and nothing is written.
func (s *Store) Update(ctx context.Context, target string, changes map[string]string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for f := range changes {
		if _, ok := profileFields[f]; !ok {
			return fmt.Errorf("unknown field %q", f)
		}
		var editable bool
		err := tx.QueryRow(ctx, `SELECT editable FROM field_rules WHERE field = $1 FOR SHARE`, f).Scan(&editable)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && !editable) {
			return fmt.Errorf("%w: %s", ErrFieldLocked, f) // no rule means no permission
		}
		if err != nil {
			return err // fail closed: a lookup error is a refusal, never a pass
		}
	}
	for f, v := range changes {
		if _, err := tx.Exec(ctx, `UPDATE profiles SET `+profileFields[f]+` = $2 WHERE user_id = $1`, target, v); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// SetRule is what the admin's configuration panel does.
func (s *Store) SetRule(ctx context.Context, field string, editable bool) error {
	_, err := s.Pool.Exec(ctx, `UPDATE field_rules SET editable = $2, version = version + 1 WHERE field = $1`, field, editable)
	return err
}

// UpdateGuarded folds the permission check into the write itself. One statement, one snapshot:
// the row is updated only if every field named is present in field_rules AND editable at that instant.
// No lock is held between a check and a write, so an admin's change is never made to wait.
func (s *Store) UpdateGuarded(ctx context.Context, target string, changes map[string]string) error {
	var sets, names []string
	args := []any{target}
	for f, v := range changes {
		col, ok := profileFields[f]
		if !ok {
			return fmt.Errorf("unknown field %q", f)
		}
		args = append(args, v)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
		names = append(names, f)
	}
	args = append(args, names, len(names))
	q := fmt.Sprintf(`UPDATE profiles SET %s WHERE user_id = $1
	    AND (SELECT count(*) FROM field_rules WHERE field = ANY($%d) AND editable) = $%d`,
		strings.Join(sets, ", "), len(args)-1, len(args))
	tag, err := s.Pool.Exec(ctx, q, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrFieldLocked // a locked field, an unknown rule or an unknown user: refused, nothing written
	}
	return nil
}
