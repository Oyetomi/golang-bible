// fencing: a lease that expires while its holder is paused, and a store that does or does not check the token.
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ctx = context.Background()

// acquire takes the lease if it is free or expired and returns a new, larger fencing token.
func acquire(db *pgxpool.Pool, who string, ttl time.Duration) (int64, bool) {
	var tok int64
	err := db.QueryRow(ctx, `UPDATE lease SET holder=$1, token=token+1, expires_at=now()+$2::interval
	                          WHERE name='settlement' AND (holder IS NULL OR expires_at < now())
	                          RETURNING token`, who, fmt.Sprintf("%d ms", ttl.Milliseconds())).Scan(&tok)
	return tok, err == nil
}

// writeNaive trusts that the caller still holds the lease.
func writeNaive(db *pgxpool.Pool, who, status string) {
	db.Exec(ctx, `UPDATE wire SET status=$1, written_by=$2 WHERE id=1`, status, who)
}

// writeFenced applies the write only if the token is at least the highest one the store has seen.
func writeFenced(db *pgxpool.Pool, who, status string, tok int64) bool {
	tag, _ := db.Exec(ctx, `UPDATE wire SET status=$1, written_by=$2, token=$3 WHERE id=1 AND token <= $3`, status, who, tok)
	return tag.RowsAffected() == 1
}

func state(db *pgxpool.Pool) string {
	var s, w string
	var t int64
	db.QueryRow(ctx, `SELECT status, COALESCE(written_by,'-'), token FROM wire WHERE id=1`).Scan(&s, &w, &t)
	return fmt.Sprintf("status=%s written_by=%s stored_token=%d", s, w, t)
}

func run(db *pgxpool.Pool, fenced bool) {
	db.Exec(ctx, `UPDATE lease SET holder=NULL, token=0, expires_at=now() WHERE name='settlement'`)
	db.Exec(ctx, `UPDATE wire SET status='pending', written_by=NULL, token=0 WHERE id=1`)
	mode := "no fencing"
	if fenced {
		mode = "with fencing"
	}
	fmt.Printf("== %s ==\n", mode)
	ttl := 500 * time.Millisecond

	tokA, _ := acquire(db, "A", ttl)
	fmt.Printf("t=0.0s   A acquires the lease, token %d, ttl %v\n", tokA, ttl)

	fmt.Printf("t=0.0s   A pauses for 1.2 s (a GC pause, a VM stall, a slow disk) and does not know\n")
	pauseEnd := time.After(1200 * time.Millisecond)

	time.Sleep(700 * time.Millisecond)
	tokB, ok := acquire(db, "B", ttl)
	fmt.Printf("t=0.7s   A's lease expired. B acquires it: ok=%v, token %d\n", ok, tokB)
	if fenced {
		fmt.Printf("t=0.7s   B writes 'settled-by-B': applied=%v\n", writeFenced(db, "B", "settled-by-B", tokB))
	} else {
		writeNaive(db, "B", "settled-by-B")
		fmt.Printf("t=0.7s   B writes 'settled-by-B'\n")
	}
	<-pauseEnd
	fmt.Printf("t=1.2s   A wakes up, still believes it holds the lease, and writes 'settled-by-A'\n")
	if fenced {
		fmt.Printf("         fenced write with token %d: applied=%v\n", tokA, writeFenced(db, "A", "settled-by-A", tokA))
	} else {
		writeNaive(db, "A", "settled-by-A")
	}
	fmt.Printf("final:   %s\n\n", state(db))
}

func main() {
	db, err := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/fencing")
	if err != nil {
		panic(err)
	}
	defer db.Close()
	run(db, false)
	run(db, true)
}
