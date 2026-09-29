package main

import (
	"context"
	"flag"
	"fmt"

	"resil"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	release := flag.String("release", "", "fraud URL: re-screen and release held payments")
	flag.Parse()
	ctx := context.Background()
	pool, _ := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/resil")
	s := &resil.Store{Pool: pool}
	if *release != "" {
		f := &resil.HTTPFraud{URL: *release, Timeout: 1e9}
		r, h, err := s.ReleaseHeld(ctx, f.Check)
		fmt.Printf("release: released=%d still_held=%d err=%v\n", r, h, err)
	}
	var n, held int
	pool.QueryRow(ctx, `SELECT count(*) FROM payments`).Scan(&n)
	pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE status='held'`).Scan(&held)
	total, unbalanced, missing, err := s.Invariants(ctx)
	fmt.Printf("payments=%d held=%d entries_sum=%d unbalanced=%d posted_without_entries=%d err=%v\n", n, held, total, unbalanced, missing, err)
}
