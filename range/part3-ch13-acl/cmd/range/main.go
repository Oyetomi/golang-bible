// Command range serves the chapter's deliberately leaky v0 routes as a practice
// target. It listens on loopback only and refuses any non-loopback client.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"time"

	"acl"

	"github.com/jackc/pgx/v5/pgxpool"
)

type lab struct {
	ID, Title, Goal, Hint string
}

var labs = []lab{
	{"bola", "One login, every account", "Logged in as acme-u3, read the memo of account 3999 (it belongs to somebody else). Submit it at /verify?lab=bola&flag=...", "GET /v0/accounts/{id} with header Authorization: acme-u3"},
	{"list", "The list that lists everything", "Find the memo that belongs to no account you own by listing accounts. Submit it at /verify?lab=list&flag=...", "GET /v0/accounts"},
	{"window", "The permission change in flight", "As acme-u3, change the email of acme-u4 (locked by the admin) without the admin ever leaving it open for you. Use the range's admin panel (as acme-u1) to open and then lock the field, and watch for a request that succeeds after the lock. Then GET /verify?lab=window.", "PUT /v0/profiles/acme-u4, POST /admin/rules?field=email&editable=true|false as acme-u1; the rule cache lives 5 s"},
	{"tenant", "Whose tenant is it?", "Make globex account 1005 hold a balance of exactly 1337 cents more than it started with, as acme-u3. Then GET /verify?lab=tenant to check.", "POST /v0/credits {tenant_id, account_id, amount}"},
}

func main() {
	addr := flag.String("addr", "127.0.0.1:8613", "listen address (must be loopback)")
	flag.Parse()
	host, _, err := net.SplitHostPort(*addr)
	if err != nil || !net.ParseIP(host).IsLoopback() {
		log.Fatalf("refusing to listen on %q: the range is loopback-only", *addr)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/acl")
	if err != nil {
		log.Fatal(err)
	}
	s := &acl.Store{Pool: pool}
	for _, q := range []string{
		`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS memo text NOT NULL DEFAULT ''`,
		`UPDATE accounts SET memo = 'FLAG{bola-sequential-ids}' WHERE id = 3999`,
		`UPDATE accounts SET memo = 'FLAG{list-with-no-scope}' WHERE id = 2500`,
		`CREATE TABLE IF NOT EXISTS lab_state (k text PRIMARY KEY, v bigint)`,
		`INSERT INTO lab_state SELECT 'tenant_start', balance FROM accounts WHERE id = 1005 ON CONFLICT DO NOTHING`,
	} {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	cache := s.NewRulesCache(5 * time.Second)
	profiles := s.ProfileRoutes(cache)
	mux.Handle("/v0/profiles/", profiles)
	mux.Handle("/v1/profiles/", profiles)
	mux.Handle("/admin/", profiles)
	mux.Handle("/", s.Routes())
	mux.HandleFunc("GET /labs", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(labs)
	})
	mux.HandleFunc("GET /verify", func(w http.ResponseWriter, r *http.Request) {
		id, f := r.URL.Query().Get("lab"), r.URL.Query().Get("flag")
		ok := false
		switch id {
		case "bola":
			ok = f == "FLAG{bola-sequential-ids}"
		case "list":
			ok = f == "FLAG{list-with-no-scope}"
		case "window":
			var email string
			var editable bool
			pool.QueryRow(ctx, `SELECT email FROM profiles WHERE user_id='acme-u4'`).Scan(&email)
			pool.QueryRow(ctx, `SELECT editable FROM field_rules WHERE field='email'`).Scan(&editable)
			ok = !editable && email != "acme-u4@example.com"
		case "tenant":
			var start, now int64
			pool.QueryRow(ctx, `SELECT v FROM lab_state WHERE k='tenant_start'`).Scan(&start)
			pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id=1005`).Scan(&now)
			ok = now-start == 1337
		}
		fmt.Fprintf(w, "%s: %v\n", id, ok)
	})
	// Loopback-only, twice: the listener above and this check.
	guard := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !net.ParseIP(h).IsLoopback() {
			http.Error(w, "loopback only", 403)
			return
		}
		mux.ServeHTTP(w, r)
	})
	log.Printf("range listening on http://%s  (labs: /labs)", *addr)
	log.Fatal(http.ListenAndServe(*addr, guard))
}
