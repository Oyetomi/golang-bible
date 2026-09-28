package acl

import (
	"fmt"
	"testing"
)

// TestFixLab is the fix half of the range. It fails on the shipped v0 routes and passes when
// /v0/accounts/{id}, /v0/accounts and /v0/credits stop leaking across principals.
// Fix the handlers (or make them call the scoped store methods), then: go test -run TestFixLab
func TestFixLab(t *testing.T) {
	s, srv := newStore(t)
	_ = s
	code, body := do(t, "GET", fmt.Sprintf("%s/v0/accounts/3999", srv.URL), "acme-u3", nil)
	if code == 200 {
		t.Errorf("bola: acme-u3 read foreign account 3999: %s", body)
	}
	code, _ = do(t, "GET", srv.URL+"/v0/accounts", "acme-u3", nil)
	_, b := do(t, "GET", srv.URL+"/v0/accounts", "acme-u3", nil)
	if code == 200 && len(b) > 20000 {
		t.Errorf("list: acme-u3 received %d bytes (more than its own 250 rows)", len(b))
	}
	var before, after int64
	s.Pool.QueryRow(t.Context(), `SELECT balance FROM accounts WHERE id=1005`).Scan(&before)
	do(t, "POST", srv.URL+"/v0/credits", "acme-u3", map[string]any{"tenant_id": "globex", "account_id": 1005, "amount": 1})
	s.Pool.QueryRow(t.Context(), `SELECT balance FROM accounts WHERE id=1005`).Scan(&after)
	if after != before {
		t.Errorf("tenant: acme-u3 changed globex account 1005 (%d -> %d)", before, after)
		s.Pool.Exec(t.Context(), `UPDATE accounts SET balance=$1 WHERE id=1005`, before)
	}
}
