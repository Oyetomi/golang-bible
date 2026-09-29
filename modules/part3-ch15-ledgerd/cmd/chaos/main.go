// chaos sends transfers between random accounts, each with a fresh idempotency key.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"math/rand/v2"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	url := flag.String("url", "http://127.0.0.1:8090", "ledgerd")
	d := flag.Duration("d", 3*time.Second, "duration")
	workers := flag.Int("w", 32, "workers")
	tag := flag.String("tag", "load", "key prefix")
	flag.Parse()
	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{MaxIdleConnsPerHost: 128}}
	var seq atomic.Int64
	var mu sync.Mutex
	codes := map[int]int{}
	var lat []time.Duration
	stop := time.Now().Add(*d)
	var wg sync.WaitGroup
	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(w), 3))
			for time.Now().Before(stop) {
				a, b := 1+r.IntN(20), 1+r.IntN(20)
				if a == b {
					continue
				}
				body := fmt.Sprintf(`{"key":"%s-%d","from":"acct-%d","to":"acct-%d","amount":%d}`, *tag, seq.Add(1), a, b, 1+r.IntN(500))
				t := time.Now()
				resp, err := client.Post(*url+"/transfers", "application/json", bytes.NewReader([]byte(body)))
				el := time.Since(t)
				code := 0
				if err == nil {
					code = resp.StatusCode
					resp.Body.Close()
				} else if strings.Contains(err.Error(), "refused") {
					code = -1 // the server was already gone: the request never started
				}
				mu.Lock()
				codes[code]++
				lat = append(lat, el)
				mu.Unlock()
			}
		}(w)
	}
	wg.Wait()
	sort.Slice(lat, func(i, j int) bool { return lat[i] < lat[j] })
	p := func(q float64) time.Duration {
		if len(lat) == 0 {
			return 0
		}
		return lat[int(float64(len(lat)-1)*q)]
	}
	fmt.Printf("sent %d (code -1 = connection refused, 0 = connection lost mid-request): codes=%v p50=%v p99=%v\n", len(lat), codes, p(.5).Round(100*time.Microsecond), p(.99).Round(100*time.Microsecond))
}
