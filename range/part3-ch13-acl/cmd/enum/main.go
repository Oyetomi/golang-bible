// enum plays a caller who owns 250 accounts and walks every id from 1001..4000.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"

	"acl"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	version := flag.String("v", "v0", "route version: v0 or v1")
	flag.Parse()
	pool, err := pgxpool.New(context.Background(), "postgres://abbey@127.0.0.1:55432/acl")
	if err != nil {
		panic(err)
	}
	s := &acl.Store{Pool: pool}
	srv := httptest.NewServer(s.Routes())
	defer srv.Close()

	me := "acme-u3"
	got, foreign, others := 0, 0, map[string]int{}
	var bal int64
	for id := 1001; id <= 4000; id++ {
		req, _ := http.NewRequest("GET", fmt.Sprintf("%s/%s/accounts/%d", srv.URL, *version, id), nil)
		req.Header.Set("Authorization", me)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			panic(err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			continue
		}
		got++
		if !strings.Contains(string(body), `"owner_id":"`+me+`"`) {
			foreign++
			if i := strings.Index(string(body), `"tenant_id":"`); i >= 0 {
				others[strings.Split(string(body)[i+13:], `"`)[0]]++
			}
		}
		var a acl.Account
		fmt.Sscanf(string(body), `{"id":%d`, &a.ID)
		_ = bal
	}
	fmt.Printf("%s: caller %s read %d of 3000 accounts; %d belong to somebody else %v\n", *version, me, got, foreign, others)
}
