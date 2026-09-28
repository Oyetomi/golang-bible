package acl

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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

// TestFixLabWindow is the fix half of the "window" lab. The admin locks the email field; from that moment
// no profile update touching email may succeed, even through a request that arrives inside the cache's lifetime.
// It fails on the shipped /v0/profiles route and passes once that route decides and writes together.
func TestFixLabWindow(t *testing.T) {
	s, _ := newStore(t)
	ctx := t.Context()
	s.SetRule(ctx, "email", true)
	s.Pool.Exec(ctx, `UPDATE profiles SET email = user_id || '@example.com'`)
	cache := s.NewRulesCache(5 * time.Second)
	srv := httptest.NewServer(s.ProfileRoutes(cache))
	defer srv.Close()

	put := func(v, who, body string) int {
		req, _ := http.NewRequest("PUT", srv.URL+"/"+v+"/profiles/acme-u4", strings.NewReader(body))
		req.Header.Set("Authorization", who)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		return resp.StatusCode
	}
	put("v0", "acme-u3", `{"first_name":"warm"}`) // warms the cache while email is open
	req, _ := http.NewRequest("POST", srv.URL+"/admin/rules?field=email&editable=false", nil)
	req.Header.Set("Authorization", "acme-u1")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()

	if code := put("v0", "acme-u3", `{"email":"x@attacker.example"}`); code == 200 {
		t.Errorf("window: v0 accepted an email change after the admin locked the field (status %d)", code)
	}
	if code := put("v1", "acme-u3", `{"email":"y@attacker.example"}`); code != 403 {
		t.Errorf("v1 should refuse the locked field, got %d", code)
	}
	s.SetRule(ctx, "email", false)
}
