// load sends POST /transfer at a steady rate and counts what came back,
// by the version that answered (X-Version) and the status code. It runs
// inside the cluster, so requests go through the Service like real
// traffic and are spread over whatever pods currently back it.
package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"time"
)

type key struct{ version, code string }

func main() {
	url := flag.String("url", "http://ledger/transfer", "target")
	rate := flag.Int("rate", 100, "requests per second")
	dur := flag.Duration("for", 60*time.Second, "how long")
	flag.Parse()

	// A fresh connection per request: the Service balances per connection,
	// so a kept-alive client would stick to one pod and hide the split.
	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{DisableKeepAlives: true}}

	var mu sync.Mutex
	counts := map[key]int{}
	var wg sync.WaitGroup

	tick := time.NewTicker(time.Second / time.Duration(*rate))
	defer tick.Stop()
	start := time.Now()
	last := start
	for time.Since(start) < *dur {
		<-tick.C
		wg.Go(func() {
			resp, err := client.Post(*url, "", nil)
			k := key{"?", "error"}
			if err == nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				k = key{resp.Header.Get("X-Version"), fmt.Sprint(resp.StatusCode)}
			}
			mu.Lock()
			counts[k]++
			mu.Unlock()
		})
		if time.Since(last) >= 10*time.Second {
			last = time.Now()
			mu.Lock()
			fmt.Printf("t=%3.0fs %s\n", time.Since(start).Seconds(), summary(counts))
			mu.Unlock()
		}
	}
	wg.Wait()
	mu.Lock()
	defer mu.Unlock()
	fmt.Printf("total %s\n", summary(counts))
}

func summary(c map[key]int) string {
	var keys []key
	for k := range c {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].version != keys[j].version {
			return keys[i].version < keys[j].version
		}
		return keys[i].code < keys[j].code
	})
	s := ""
	for _, k := range keys {
		s += fmt.Sprintf(" %s/%s=%d", k.version, k.code, c[k])
	}
	return s
}
