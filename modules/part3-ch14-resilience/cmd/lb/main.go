package main

import (
	"flag"
	"log"
	"net/http"
	"strings"

	"resil"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:9000", "listen address")
	backends := flag.String("backends", "http://127.0.0.1:9001,http://127.0.0.1:9002", "comma-separated")
	health := flag.Bool("health", false, "probe /healthz and stop sending to dead backends")
	retry := flag.Bool("retry", false, "retry a failed request once on another backend")
	flag.Parse()
	lb := resil.NewLB(strings.Split(*backends, ","), *health, *retry)
	log.Fatal(http.ListenAndServe(*addr, lb))
}
