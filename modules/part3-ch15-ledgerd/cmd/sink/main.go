package main

import (
	"flag"
	"log"
	"net/http"

	"ledgerd/internal/sink"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:9200", "listen address")
	flag.Parse()
	log.Fatal(http.ListenAndServe(*addr, sink.New().Handler()))
}
