// idem: the same payment delivered twice, with and without a dedup key.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"sqssec/sqs"
)

func main() {
	ctx := context.Background()
	cl, _, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	defer sqs.Cleanup(cl, "idem")
	os.Remove("out/idem-dedup.txt")
	dd, err := sqs.OpenDedup("out/idem-dedup.txt")
	if err != nil {
		panic(err)
	}

	for _, idempotent := range []bool{false, true} {
		url, _ := sqs.CreateQueue(ctx, cl, fmt.Sprintf("idem-%t", idempotent), nil)
		// The producer retried after a timeout and sent the same payment twice:
		// two distinct SQS messages (distinct MessageId), one payment_id.
		p := sqs.Payment{PaymentID: fmt.Sprintf("p-dup-%t", idempotent), Account: "acct-9", AmountMinor: 2500, Currency: "USD"}
		sqs.Send(ctx, cl, url, p)
		sqs.Send(ctx, cl, url, p)

		var mu sync.Mutex
		balance := int64(0) // acct-9 starts at 0
		credits := 0
		pool := &sqs.Pool{Client: cl, URL: url, Concurrency: 1, Wait: 1}
		pool.Handle = func(_ context.Context, m types.Message) error {
			var ev sqs.Payment
			json.Unmarshal([]byte(*m.Body), &ev)
			if idempotent {
				if dd.Seen(ev.PaymentID) {
					fmt.Printf("  skip duplicate %s (MessageId %.8s)\n", ev.PaymentID, *m.MessageId)
					return nil // already handled: delete without touching the ledger
				}
				if !dd.Begin(ev.PaymentID) {
					// the twin is mid-flight: do NOT delete, in case it fails
					return errors.New("same payment in flight, retry later")
				}
				defer dd.Done(ev.PaymentID)
			}
			mu.Lock()
			balance += ev.AmountMinor
			credits++
			mu.Unlock()
			fmt.Printf("  credit %s +%d (MessageId %.8s)\n", ev.PaymentID, ev.AmountMinor, *m.MessageId)
			return nil
		}
		fmt.Printf("handler with dedup key = %t\n", idempotent)
		runFor(pool, 4)
		v, f, _ := sqs.Depth(ctx, cl, url)
		fmt.Printf("  queue left: visible=%s in-flight=%s\n", v, f)
		fmt.Printf("  => 2 messages delivered, ledger credited %d time(s), acct-9 balance = %d (should be 2500)\n",
			credits, balance)
	}
}

func runFor(p *sqs.Pool, secs int) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(secs)*time.Second)
	defer cancel()
	p.Run(ctx)
}
