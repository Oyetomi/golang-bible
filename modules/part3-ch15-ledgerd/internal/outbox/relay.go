// Package outbox publishes the events the ledger wrote in the same transaction as the money.
package outbox

import (
	"bytes"
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Relay struct {
	Pool    *pgxpool.Pool
	SinkURL string
	Batch   int
	// CrashAfterPublish makes Run stop after publishing a batch but before marking it, once.
	// It exists to show at-least-once delivery; never set it in production.
	CrashAfterPublish bool
	Published         int // events sent (including re-sends)
}

// Once claims up to Batch unpublished events, sends each to the sink, and marks them published.
// FOR UPDATE SKIP LOCKED lets several relays run side by side without sending the same row twice at once.
func (r *Relay) Once(ctx context.Context) (n int, crashed bool, err error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT id, payload FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, r.Batch)
	if err != nil {
		return 0, false, err
	}
	type ev struct {
		id      int64
		payload []byte
	}
	var evs []ev
	for rows.Next() {
		var e ev
		if err := rows.Scan(&e.id, &e.payload); err != nil {
			rows.Close()
			return 0, false, err
		}
		evs = append(evs, e)
	}
	rows.Close()
	if len(evs) == 0 {
		return 0, false, nil
	}
	c := &http.Client{Timeout: 2 * time.Second}
	for _, e := range evs {
		req, _ := http.NewRequestWithContext(ctx, "POST", r.SinkURL+"/events", bytes.NewReader(e.payload))
		req.Header.Set("X-Event-ID", itoa(e.id))
		resp, err := c.Do(req)
		if err != nil || resp.StatusCode != 200 {
			if resp != nil {
				resp.Body.Close()
			}
			return n, false, err // leave the rest unmarked; they go out on the next pass
		}
		resp.Body.Close()
		n++
		r.Published++
	}
	if r.CrashAfterPublish {
		r.CrashAfterPublish = false
		return n, true, nil // the transaction rolls back: the events stay unmarked and will be re-sent
	}
	for _, e := range evs {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = now() WHERE id = $1`, e.id); err != nil {
			return n, false, err
		}
	}
	return n, false, tx.Commit(ctx)
}

var _ = pgx.ErrNoRows

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
