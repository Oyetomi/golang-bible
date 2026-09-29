// load drives a payd (or a load balancer) with two kinds of caller:
// "normal" clients, each on its own account at a steady rate, and a "bot" hammering one account.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type result struct {
	mu   sync.Mutex
	lat  []time.Duration
	code map[int]int
}

func (r *result) add(code int, d time.Duration) {
	r.mu.Lock()
	r.lat = append(r.lat, d)
	r.code[code]++
	r.mu.Unlock()
}

func (r *result) String() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	sort.Slice(r.lat, func(i, j int) bool { return r.lat[i] < r.lat[j] })
	q := func(p float64) time.Duration {
		if len(r.lat) == 0 {
			return 0
		}
		return r.lat[int(float64(len(r.lat)-1)*p)]
	}
	return fmt.Sprintf("n=%-6d p50=%-8v p99=%-8v codes=%v", len(r.lat), q(.5).Round(100*time.Microsecond), q(.99).Round(100*time.Microsecond), r.code)
}

func main() {
	url := flag.String("url", "http://127.0.0.1:9001", "target")
	dur := flag.Duration("d", 5*time.Second, "duration")
	normals := flag.Int("normal", 40, "normal clients (accounts 100..)")
	rps := flag.Int("rps", 20, "requests/second per normal client")
	bots := flag.Int("bot", 0, "bot workers hammering account 7")
	tag := flag.String("tag", "run", "key prefix")
	bigPct := flag.Int("bigpct", 0, "percent of payments that are large (50,000)")
	flag.Parse()

	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{MaxIdleConnsPerHost: 512, MaxConnsPerHost: 512}}
	var seq atomic.Int64
	post := func(from, to int) (int, time.Duration) {
		key := fmt.Sprintf("%s-%d-%d", *tag, time.Now().UnixNano(), seq.Add(1))
		amt := 500
		if *bigPct > 0 && int(seq.Load())%100 < *bigPct {
			amt = 50000
		}
		body := fmt.Sprintf(`{"key":%q,"from":%d,"to":%d,"amount":%d}`, key, from, to, amt)
		t := time.Now()
		resp, err := client.Post(*url+"/pay", "application/json", bytes.NewReader([]byte(body)))
		d := time.Since(t)
		if err != nil {
			return 0, d
		}
		resp.Body.Close()
		return resp.StatusCode, d
	}
	normal, bot := &result{code: map[int]int{}}, &result{code: map[int]int{}}
	stop := time.Now().Add(*dur)
	var wg sync.WaitGroup
	for i := 0; i < *normals; i++ {
		wg.Add(1)
		go func(acct int) {
			defer wg.Done()
			tick := time.NewTicker(time.Second / time.Duration(*rps))
			defer tick.Stop()
			for time.Now().Before(stop) {
				<-tick.C
				c, d := post(acct, acct+500)
				normal.add(c, d)
			}
		}(100 + i)
	}
	for i := 0; i < *bots; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for time.Now().Before(stop) {
				c, d := post(7, 8)
				bot.add(c, d)
			}
		}()
	}
	wg.Wait()
	fmt.Println("normal:", normal)
	if *bots > 0 {
		fmt.Println("bot:   ", bot)
	}
}
