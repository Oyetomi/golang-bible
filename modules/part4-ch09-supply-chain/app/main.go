// ledger-api is the program whose journey to production we secure. It is
// deliberately small: what matters in this chapter is the image around it.
package main

import (
	"fmt"
	"log"
	"net/http"
	"runtime/debug"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// greeting is set at build time (-ldflags -X main.greeting=...), so a build
// can be made different on purpose.
var greeting = "ok"

func main() {
	info, _ := debug.ReadBuildInfo()
	http.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "%s, built with %s\n", greeting, info.GoVersion)
	})
	http.Handle("GET /metrics", promhttp.Handler())
	log.Println("ledger-api on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
