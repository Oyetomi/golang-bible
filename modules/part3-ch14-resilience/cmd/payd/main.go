package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"time"

	"resil"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:9001", "listen address")
	limit := flag.Float64("limit", 0, "per-account payments per second (0 = off)")
	burst := flag.Int("burst", 5, "per-account burst")
	global := flag.Bool("global", false, "one shared bucket instead of one per account")
	fraud := flag.String("fraud", "", "fraud service URL (empty = no fraud check)")
	pol := flag.String("policy", "closed", "closed | open | degrade")
	breaker := flag.Bool("breaker", false, "use a circuit breaker around the fraud call")
	timeout := flag.Duration("fraud-timeout", 300*time.Millisecond, "deadline for the fraud call")
	conns := flag.Int("conns", 8, "database pool size")
	flag.Parse()

	cfg, _ := pgxpool.ParseConfig("postgres://abbey@127.0.0.1:55432/resil")
	cfg.MaxConns = int32(*conns)
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		log.Fatal(err)
	}
	c := resil.Config{GlobalKey: *global, SmallLimit: 10_000}
	if *limit > 0 {
		c.Limiter = resil.NewPerAccount(*limit, *burst)
	}
	if *fraud != "" {
		c.Fraud = &resil.HTTPFraud{URL: *fraud, Timeout: *timeout}
		if *breaker {
			c.Breaker = resil.NewBreaker(5, 2*time.Second)
		}
	}
	switch *pol {
	case "open":
		c.Policy = resil.FailOpen
	case "degrade":
		c.Policy = resil.FailDegrade
	}
	s := &resil.Store{Pool: pool}
	log.Printf("payd on %s limit=%v global=%v fraud=%q policy=%s breaker=%v", *addr, *limit, *global, *fraud, *pol, *breaker)
	log.Fatal(http.ListenAndServe(*addr, s.Handler(c)))
}
