// rls measures four things about Postgres row-level security as seen from Go.
package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func count(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (n int, tenant string) {
	var t *string
	if err := q.QueryRow(ctx, `SELECT count(*), current_setting('app.tenant', true) FROM accounts`).Scan(&n, &t); err != nil {
		panic(err)
	}
	if t != nil {
		tenant = *t
	}
	return
}

func main() {
	ctx := context.Background()

	// 1. Superusers always bypass RLS; the table OWNER bypasses it unless FORCE is on.
	su, _ := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/acl")
	n, _ := count(ctx, su)
	fmt.Printf("1a. superuser, no tenant set: sees %d rows (always bypasses)\n", n)
	owner, _ := pgxpool.New(ctx, "postgres://meridian_owner:owner@127.0.0.1:55432/acl")
	n, _ = count(ctx, owner)
	fmt.Printf("1b. the table owner: sees %d rows (bypasses unless FORCE)\n", n)
	su.Exec(ctx, `ALTER TABLE accounts FORCE ROW LEVEL SECURITY`)
	n, _ = count(ctx, owner)
	fmt.Printf("1c. same owner after FORCE ROW LEVEL SECURITY: sees %d rows\n", n)
	su.Exec(ctx, `ALTER TABLE accounts NO FORCE ROW LEVEL SECURITY`)

	// 2. A separate low-privilege app role is filtered.
	cfg, _ := pgxpool.ParseConfig("postgres://meridian_app:app@127.0.0.1:55432/acl")
	cfg.MaxConns = 1 // one connection so the pool MUST reuse it
	app, _ := pgxpool.NewWithConfig(ctx, cfg)
	n, _ = count(ctx, app)
	fmt.Printf("2. app role, no tenant set: sees %d rows (fails closed: current_setting is NULL)\n", n)

	// 3. Per-transaction scope: set_config(..., true) is SET LOCAL.
	tx, _ := app.Begin(ctx)
	tx.Exec(ctx, `SELECT set_config('app.tenant', 'acme', true)`)
	n, t := count(ctx, tx)
	fmt.Printf("3. inside tx with tenant=%s: sees %d rows\n", t, n)
	tx.Commit(ctx)
	n, t = count(ctx, app)
	fmt.Printf("   after COMMIT, same pooled connection: sees %d rows, tenant=%q (scope died with the tx)\n", n, t)

	// 4. THE TRAP: a session-level SET survives on the pooled connection.
	app.Exec(ctx, `SELECT set_config('app.tenant', 'acme', false)`)
	fmt.Println("4. a request runs a session-level SET app.tenant='acme', then returns its connection to the pool")
	n, t = count(ctx, app)
	fmt.Printf("   the NEXT request (any user, any tenant) reuses it: sees %d rows, tenant=%q\n", n, t)

	// 5. WITH CHECK also blocks writes into another tenant.
	tx, _ = app.Begin(ctx)
	tx.Exec(ctx, `SELECT set_config('app.tenant', 'acme', true)`)
	_, err := tx.Exec(ctx, `INSERT INTO accounts (tenant_id, owner_id, balance) VALUES ('globex','globex-u3',1)`)
	fmt.Printf("5. tenant=acme inserting a globex row: %v\n", err)
	tx.Rollback(ctx)
}
