package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync/atomic"
	"syscall"
	"time"

	"ledgerd/internal/api"
	"ledgerd/internal/outbox"
	"ledgerd/internal/store"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8090", "listen address")
	dsn := flag.String("dsn", "postgres://abbey@127.0.0.1:55432/ledgerd", "postgres dsn")
	sinkURL := flag.String("sink", "http://127.0.0.1:9200", "event consumer")
	publish := flag.String("publish", "outbox", "outbox | naive (publish after commit, no outbox)")
	limit := flag.Float64("limit", 0, "per-account transfers/second (0 = off)")
	quiet := flag.Bool("quiet", false, "log only errors")
	flag.Parse()

	lvl := slog.LevelInfo
	if *quiet {
		lvl = slog.LevelError
	}
	log := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: lvl}))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, _ := pgxpool.ParseConfig(*dsn)
	cfg.MaxConns = 16
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	st := &store.Store{Pool: pool}

	var lim *api.Limits
	if *limit > 0 {
		lim = api.NewLimits(*limit, 5)
	}
	srv := api.New(st, log, lim)
	h := srv.Handler()
	if *publish == "naive" {
		h = naive(h, *sinkURL) // the dual write: commit, then publish, with nothing joining the two
	}

	httpSrv := &http.Server{Addr: *addr, Handler: h}
	relayDone := make(chan struct{})
	if *publish == "outbox" {
		go func() {
			defer close(relayDone)
			r := &outbox.Relay{Pool: pool, SinkURL: *sinkURL, Batch: 100}
			for ctx.Err() == nil {
				n, _, err := r.Once(ctx)
				if err != nil && ctx.Err() == nil {
					log.Error("relay", "err", err)
				}
				if n == 0 {
					select {
					case <-ctx.Done():
					case <-time.After(50 * time.Millisecond):
					}
				}
			}
		}()
	} else {
		close(relayDone)
	}

	go func() {
		log.Info("listening", "addr", *addr, "publish", *publish)
		if err := httpSrv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			log.Error("serve", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutting down: draining in-flight requests")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Error("shutdown", "err", err)
	}
	<-relayDone
	log.Info("stopped")
}

var naiveSeq atomic.Int64

// naive wraps the handler: after a 201 it POSTs the event to the sink itself.
func naive(next http.Handler, sinkURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/transfers" {
			next.ServeHTTP(w, r)
			return
		}
		body := new(bytes.Buffer)
		body.ReadFrom(r.Body)
		r.Body = readCloser{bytes.NewReader(body.Bytes())}
		rec := &recorder{ResponseWriter: w, code: 200}
		next.ServeHTTP(rec, r)
		if rec.code == 201 {
			// the transaction is committed; the process can die right here
			req, _ := http.NewRequest("POST", sinkURL+"/events", bytes.NewReader(bodyToEvent(body.Bytes())))
			req.Header.Set("X-Event-ID", strconv.FormatInt(naiveSeq.Add(1), 10))
			if resp, err := http.DefaultClient.Do(req); err == nil {
				resp.Body.Close()
			}
		}
	})
}

type recorder struct {
	http.ResponseWriter
	code int
}

func (r *recorder) WriteHeader(c int) { r.code = c; r.ResponseWriter.WriteHeader(c) }

type readCloser struct{ *bytes.Reader }

func (readCloser) Close() error { return nil }
