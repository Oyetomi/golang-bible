package acl

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func setupProfiles(t *testing.T) *Store {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "postgres://abbey@127.0.0.1:55432/acl")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	s := &Store{Pool: pool}
	ctx := context.Background()
	pool.Exec(ctx, `UPDATE field_rules SET editable = false, version = 1 WHERE field IN ('email','address')`)
	pool.Exec(ctx, `UPDATE field_rules SET editable = true, version = 1 WHERE field IN ('first_name','last_name')`)
	pool.Exec(ctx, `UPDATE profiles SET first_name = 'First-'||user_id, email = user_id || '@example.com', address = '1 Meridian Way'`)
	return s
}

func emailOf(s *Store, id string) string {
	var e string
	s.Pool.QueryRow(context.Background(), `SELECT email FROM profiles WHERE user_id=$1`, id).Scan(&e)
	return e
}

// Bug 1: the caller is told "no", and the data has changed anyway.
func TestApplyThenCheck(t *testing.T) {
	s := setupProfiles(t)
	ctx := context.Background()
	cache := &RulesCache{TTL: time.Second, Refresh: s.LoadRules}
	target := "acme-u4"
	before := emailOf(s, target)
	err := s.UpdateApplyThenCheck(ctx, cache, target, map[string]string{"email": "attacker@example.com", "first_name": "Renamed"})
	t.Logf("apply-then-check: returned %q", err)
	t.Logf("   email before: %s   email after: %s   <- the write happened", before, emailOf(s, target))
	if !errors.Is(err, ErrFieldLocked) {
		t.Fatal("expected a denial")
	}

	s = setupProfiles(t)
	err = s.Update(ctx, target, map[string]string{"email": "attacker@example.com", "first_name": "Renamed"})
	var fn string
	s.Pool.QueryRow(ctx, `SELECT first_name FROM profiles WHERE user_id=$1`, target).Scan(&fn)
	t.Logf("check-then-write in one transaction: returned %q", err)
	t.Logf("   email after: %s   first_name after: %s   <- nothing written, not even the allowed field", emailOf(s, target), fn)
}

// Bug 2: a cache that lags a rule change keeps allowing writes after the admin locked the field.
func hammer(s *Store, write func(i int) error, window time.Duration) (attempts, denied int64) {
	var wg sync.WaitGroup
	var a, d atomic.Int64
	stop := time.Now().Add(window)
	for w := 0; w < 8; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; time.Now().Before(stop); i++ {
				a.Add(1)
				if err := write(w*1_000_000 + i); errors.Is(err, ErrFieldLocked) {
					d.Add(1)
				}
			}
		}(w)
	}
	wg.Wait()
	return a.Load(), d.Load()
}

func TestRuleChangeWindow(t *testing.T) {
	ctx := context.Background()
	for _, mode := range []string{"cached check (TTL 400 ms)", "check and write in one transaction", "one guarded statement"} {
		s := setupProfiles(t)
		s.SetRule(ctx, "email", true) // the field is open
		cache := &RulesCache{TTL: 400 * time.Millisecond, Refresh: s.LoadRules}
		cache.Editable(ctx, "email") // a request warms the cache while the field is open

		var lockedAt atomic.Int64 // when the admin's change committed (0 = not yet)
		var adminMs atomic.Int64
		var wrong, ok atomic.Int64
		go func() {
			time.Sleep(100 * time.Millisecond)
			t0 := time.Now()
			s.SetRule(ctx, "email", false) // the admin locks the field again
			lockedAt.Store(time.Now().UnixNano())
			adminMs.Store(time.Since(t0).Milliseconds())
		}()
		write := func(i int) error {
			began := time.Now().UnixNano()
			v := fmt.Sprintf("w%d@example.com", i)
			var err error
			if mode[0:2] == "ca" {
				err = s.UpdateCachedCheck(ctx, cache, "acme-u4", map[string]string{"email": v})
			} else if mode[0:2] == "on" {
				err = s.UpdateGuarded(ctx, "acme-u4", map[string]string{"email": v})
			} else {
				err = s.Update(ctx, "acme-u4", map[string]string{"email": v})
			}
			if err == nil {
				ok.Add(1)
				if l := lockedAt.Load(); l != 0 && began > l {
					wrong.Add(1) // the request started after the lock committed, and it still wrote
				}
			}
			return err
		}
		a, d := hammer(s, write, 800*time.Millisecond)
		time.Sleep(50 * time.Millisecond)
		t.Logf("%-36s %6d attempts, %6d refused, %5d writes succeeded, %5d of them started AFTER the lock committed; admin's change took %d ms", mode, a, d, ok.Load(), wrong.Load(), adminMs.Load())
	}
}
