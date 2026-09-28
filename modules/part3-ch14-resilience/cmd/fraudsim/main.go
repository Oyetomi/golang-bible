// fraudsim is a stand-in fraud service whose behaviour you can change while it runs:
// GET /mode?delay=200ms&fail=1 makes it slow or broken; GET /mode?delay=0&fail=0 heals it.
package main

import (
	"flag"
	"log"
	"net/http"
	"sync/atomic"
	"time"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:9100", "listen address")
	flag.Parse()
	var delay atomic.Int64
	var fail atomic.Bool
	http.HandleFunc("/mode", func(w http.ResponseWriter, r *http.Request) {
		d, _ := time.ParseDuration(r.URL.Query().Get("delay"))
		delay.Store(int64(d))
		fail.Store(r.URL.Query().Get("fail") == "1")
		w.Write([]byte("ok\n"))
	})
	http.HandleFunc("/check", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(time.Duration(delay.Load()))
		if fail.Load() {
			http.Error(w, "boom", 503)
			return
		}
		w.Write([]byte(`{"allow":true,"reason":"ok"}`))
	})
	log.Fatal(http.ListenAndServe(*addr, nil))
}
