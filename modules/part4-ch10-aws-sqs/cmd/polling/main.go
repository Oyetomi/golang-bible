// polling: short vs long polling over 20 s of an idle queue.
package main

import (
	"context"
	"fmt"
	"time"

	"sqssec/sqs"
)

func main() {
	ctx := context.Background()
	cl, calls, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	url, err := sqs.CreateQueue(ctx, cl, "poll", nil)
	if err != nil {
		panic(err)
	}
	defer sqs.Cleanup(cl, "poll")

	// Short polling: WaitTimeSeconds=0, loop with a 100 ms pause (a naive loop
	// with no pause would simply make more calls, faster).
	start, base, empty := time.Now(), calls.N(), 0
	for time.Since(start) < 20*time.Second {
		msgs, err := sqs.Receive(ctx, cl, url, 10, 0)
		if err != nil {
			panic(err)
		}
		if len(msgs) == 0 {
			empty++
		}
		time.Sleep(100 * time.Millisecond)
	}
	fmt.Printf("short poll (wait=0, 100ms pause): %5d empty receives, %5d HTTP calls in %.1fs\n",
		empty, calls.N()-base, time.Since(start).Seconds())

	// Long polling: WaitTimeSeconds=20. The call parks server-side.
	start, base, empty = time.Now(), calls.N(), 0
	for time.Since(start) < 20*time.Second {
		msgs, err := sqs.Receive(ctx, cl, url, 10, 20)
		if err != nil {
			panic(err)
		}
		if len(msgs) == 0 {
			empty++
		}
	}
	fmt.Printf("long poll  (wait=20):             %5d empty receives, %5d HTTP calls in %.1fs\n",
		empty, calls.N()-base, time.Since(start).Seconds())

	// Latency: a long poll parked on the empty queue, a message sent 3 s later.
	type res struct{ at time.Time }
	got := make(chan res)
	go func() {
		for {
			msgs, _ := sqs.Receive(ctx, cl, url, 1, 20)
			if len(msgs) > 0 {
				got <- res{time.Now()}
				return
			}
		}
	}()
	time.Sleep(3 * time.Second)
	sent := time.Now()
	sqs.Send(ctx, cl, url, sqs.Payment{PaymentID: "p-1", Account: "acct-1", AmountMinor: 1250, Currency: "USD"})
	r := <-got
	fmt.Printf("long poll parked, message sent -> received after %d ms\n", r.at.Sub(sent).Milliseconds())
}
