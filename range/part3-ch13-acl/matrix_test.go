package acl

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// One row per (route, actor, resource-owner). Every cross-principal cell must be a denial.
func TestMatrix(t *testing.T) {
	s, srv := newStore(t)
	ctx := context.Background()
	users := []string{"acme-u3", "acme-u4", "globex-u3", "initech-u3"}
	own := map[string]int64{}
	for _, u := range users {
		var id int64
		s.Pool.QueryRow(ctx, `SELECT min(id) FROM accounts WHERE owner_id=$1`, u).Scan(&id)
		own[u] = id
	}
	for _, v := range []string{"v0", "v1"} {
		cells, leaks := 0, 0
		var first string
		for _, actor := range users {
			for _, owner := range users {
				if actor == owner {
					continue
				}
				cells++
				code, _ := do(t, "GET", fmt.Sprintf("%s/%s/accounts/%d", srv.URL, v, own[owner]), actor, nil)
				if code == 200 {
					leaks++
					if first == "" {
						first = fmt.Sprintf("%s read %s's account %d", actor, owner, own[owner])
					}
				}
			}
		}
		t.Logf("GET /%s/accounts/{id}: %d cross-principal cells, %d leaked  %s", v, cells, leaks, first)
		if v == "v1" && leaks != 0 {
			t.Errorf("v1 leaked %d cells", leaks)
		}
	}
}

// The public message goes to the client; the internal one goes to the log.
type AppError struct {
	Public   string
	Internal error
}

func (e *AppError) Error() string { return e.Public }

func TestErrorSplit(t *testing.T) {
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig("postgres://meridian_app:app@127.0.0.1:55432/acl")
	pool, _ := pgxpool.NewWithConfig(ctx, cfg)
	defer pool.Close()
	_, err := pool.Exec(ctx, `DELETE FROM accounts WHERE id = 1001`) // app role has no DELETE
	raw := &AppError{Public: "could not update account", Internal: err}
	t.Logf("what the database said (log this): %v", raw.Internal)
	t.Logf("what the client gets:              %q", raw.Error())
	if strings.Contains(raw.Error(), "accounts") {
		t.Error("public message leaks a table name")
	}
}
