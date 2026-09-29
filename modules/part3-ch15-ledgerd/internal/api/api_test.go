package api

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ledgerd/internal/store"

	"github.com/jackc/pgx/v5/pgxpool"
)

func setup(t *testing.T, lim *Limits) *httptest.Server {
	t.Helper()
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://abbey@127.0.0.1:55432/ledgerd")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	pool.Exec(ctx, `TRUNCATE outbox, idempotency_keys, postings, transactions, accounts RESTART IDENTITY CASCADE`)
	pool.Exec(ctx, `INSERT INTO accounts (id,currency,kind) VALUES ('treasury','USD','system'),('a','USD','customer'),('b','USD','customer')`)
	st := &store.Store{Pool: pool}
	if _, err := st.Transfer(ctx, store.TransferReq{Key: "fund", From: "treasury", To: "a", Amount: 10000}); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(New(st, slog.New(slog.NewTextHandler(io.Discard, nil)), lim).Handler())
	t.Cleanup(srv.Close)
	return srv
}

func post(t *testing.T, srv *httptest.Server, body string) (int, string) {
	t.Helper()
	resp, err := http.Post(srv.URL+"/transfers", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, strings.TrimSpace(string(b))
}

func TestStatusCodes(t *testing.T) {
	srv := setup(t, nil)
	cases := []struct {
		name, body string
		want       int
	}{
		{"created", `{"key":"k1","from":"a","to":"b","amount":2500}`, 201},
		{"replay of the same request", `{"key":"k1","from":"a","to":"b","amount":2500}`, 200},
		{"same key, different amount", `{"key":"k1","from":"a","to":"b","amount":9999}`, 409},
		{"insufficient funds", `{"key":"k2","from":"a","to":"b","amount":999999}`, 422},
		{"unknown account", `{"key":"k3","from":"a","to":"nope","amount":1}`, 404},
		{"malformed", `{not json`, 400},
		{"no idempotency key", `{"from":"a","to":"b","amount":1}`, 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			code, body := post(t, srv, c.body)
			t.Logf("%-28s -> %d %s", c.name, code, body)
			if code != c.want {
				t.Fatalf("got %d want %d", code, c.want)
			}
		})
	}
}

func TestRateLimitAndMetrics(t *testing.T) {
	srv := setup(t, NewLimits(1, 3))
	var ok, limited int
	for i := 0; i < 10; i++ {
		code, _ := post(t, srv, fmt.Sprintf(`{"key":"r%d","from":"a","to":"b","amount":1}`, i))
		if code == 201 {
			ok++
		} else if code == 429 {
			limited++
		}
	}
	t.Logf("10 rapid transfers from one account with burst 3: %d accepted, %d rate limited", ok, limited)
	resp, _ := http.Get(srv.URL + "/metrics")
	b, _ := io.ReadAll(resp.Body)
	for _, l := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(l, "transfers_total") {
			t.Log(l)
		}
	}
}
