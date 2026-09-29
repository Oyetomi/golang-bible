package acl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func newStore(t *testing.T) (*Store, *httptest.Server) {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "postgres://abbey@127.0.0.1:55432/acl")
	if err != nil {
		t.Fatal(err)
	}
	// RLS is on for accounts; the owner bypasses it, so these tests exercise the app-layer checks.
	s := &Store{Pool: pool}
	srv := httptest.NewServer(s.Routes())
	t.Cleanup(func() { srv.Close(); pool.Close() })
	return s, srv
}

func do(t *testing.T, method, url, user string, body any) (int, []byte) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, url, rd)
	req.Header.Set("Authorization", user)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, b
}

func TestListSizes(t *testing.T) {
	_, srv := newStore(t)
	for _, v := range []string{"v0", "v1"} {
		code, b := do(t, "GET", srv.URL+"/"+v+"/accounts", "acme-u3", nil)
		var as []Account
		json.Unmarshal(b, &as)
		tenants := map[string]bool{}
		for _, a := range as {
			tenants[a.TenantID] = true
		}
		t.Logf("%s GET /accounts as acme-u3: %d, %d rows, %d bytes, %d tenants visible", v, code, len(as), len(b), len(tenants))
	}
}

func TestBodyTenant(t *testing.T) {
	s, srv := newStore(t)
	ctx := context.Background()
	var target int64
	s.Pool.QueryRow(ctx, `SELECT min(id) FROM accounts WHERE tenant_id='globex'`).Scan(&target)
	before, _ := s.AccountByID(ctx, target)
	// caller is acme-u3 but names globex in the body
	code, b := do(t, "POST", srv.URL+"/v0/credits", "acme-u3", map[string]any{"tenant_id": "globex", "account_id": target, "amount": 999999})
	t.Logf("v0 credit as acme-u3 naming tenant globex: %d %s", code, bytes.TrimSpace(b))
	code, b = do(t, "POST", srv.URL+"/v1/credits", "acme-u3", map[string]any{"tenant_id": "globex", "account_id": target, "amount": 999999})
	t.Logf("v1 same request: %d %s", code, bytes.TrimSpace(b))
	after, _ := s.AccountByID(ctx, target)
	t.Logf("globex account %d balance: before %d, after %d (v0 moved it by %d)", target, before.Balance, after.Balance, after.Balance-before.Balance)
	s.Pool.Exec(ctx, `UPDATE accounts SET balance=$2 WHERE id=$1`, target, before.Balance)
}

func TestOracle(t *testing.T) {
	_, srv := newStore(t)
	for _, v := range []string{"v1", "v2"} {
		exist, missing := 0, 0
		for id := 1001; id <= 4100; id++ { // 100 ids past the end don't exist
			code, _ := do(t, "GET", fmt.Sprintf("%s/%s/accounts/%d", srv.URL, v, id), "acme-u3", nil)
			switch code {
			case 403:
				exist++
			case 404:
				missing++
			}
		}
		t.Logf("%s: attacker separates real ids from fake ones via status alone: %d confirmed-to-exist (403), %d 404", v, exist, missing)
	}
}

func TestPeerIDOR(t *testing.T) {
	s, _ := newStore(t)
	ctx := context.Background()
	admin169 := Principal{UserID: "globex-u1", TenantID: "globex", Role: "admin"}
	reset := func() { s.Pool.Exec(ctx, `UPDATE users SET password_hash='h(pw)' WHERE id='globex-u2'`) }
	reset()
	err := s.SetPasswordVuln(ctx, admin169, "globex-u2", "h(attacker)")
	var h string
	s.Pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id='globex-u2'`).Scan(&h)
	t.Logf("VULN admin globex-u1 -> globex-u2: err=%v, stored hash now %q", err, h)
	reset()
	err = s.SetPasswordSafe(ctx, admin169, "globex-u2", "h(pw)", "h(attacker)")
	s.Pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id='globex-u2'`).Scan(&h)
	t.Logf("SAFE same call:                          err=%v, stored hash %q", err, h)
	u2 := Principal{UserID: "globex-u2", TenantID: "globex", Role: "admin"}
	err = s.SetPasswordSafe(ctx, u2, "globex-u2", "h(wrong)", "h(new)")
	t.Logf("SAFE owner, wrong current password:      err=%v", err)
	err = s.SetPasswordSafe(ctx, u2, "globex-u2", "h(pw)", "h(new)")
	t.Logf("SAFE owner, right current password:      err=%v", err)
	reset()
}

func TestGrant(t *testing.T) {
	s, _ := newStore(t)
	ctx := context.Background()
	s.Pool.Exec(ctx, `DELETE FROM grants`)
	s.Pool.Exec(ctx, `INSERT INTO grants VALUES ('proj/meridian','acme-u1','owner'),('proj/meridian','acme-u2','editor')`)
	t.Logf("stranger self-grants owner : %v", s.Grant(ctx, "globex-u3", "globex-u3", "proj/meridian", "owner"))
	t.Logf("editor grants viewer       : %v", s.Grant(ctx, "acme-u2", "globex-u3", "proj/meridian", "viewer"))
	t.Logf("owner grants viewer        : %v", s.Grant(ctx, "acme-u1", "acme-u3", "proj/meridian", "viewer"))
	t.Logf("owner grants a role 'god'  : %v", s.Grant(ctx, "acme-u1", "acme-u3", "proj/meridian", "god"))
}

func TestDefaultDeny(t *testing.T) {
	for _, c := range [][2]string{{"viewer", "write"}, {"admin", "write"}, {"superuser", "read"}, {"admin", "delet"}} {
		t.Logf("%-9s %-6s -> %v", c[0], c[1], Authorize(c[0], c[1]))
	}
}

func TestSecondDoor(t *testing.T) {
	s, _ := newStore(t)
	ctx := context.Background()
	for _, id := range []string{"1001", "1001 OR true"} {
		n, err := s.CountByIDConcat(ctx, id)
		t.Logf("concatenated  id=%-14q -> %d rows, err=%v", id, n, err)
		_, err = s.AccountByID(ctx, mustAtoi(id))
		_ = err
	}
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM accounts WHERE id = $1`, "1001 OR true").Scan(&n)
	t.Logf("parameterized id=%-14q -> err=%v", "1001 OR true", err)
}

func mustAtoi(s string) int64 {
	var n int64
	fmt.Sscanf(s, "%d", &n)
	return n
}
