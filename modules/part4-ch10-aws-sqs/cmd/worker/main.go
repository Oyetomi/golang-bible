// worker: bounded pool, long polling, graceful SIGTERM.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/sqs/types"

	"sqssec/sqs"
)

func main() {
	name := flag.String("name", "worker", "label in log lines")
	conc := flag.Int("conc", 4, "max in-flight messages")
	runFor := flag.Duration("for", 0, "stop by itself after this long (0 = until SIGTERM)")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	cl, _, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	url, err := sqs.CreateQueue(ctx, cl, "worker", map[string]string{"VisibilityTimeout": "10"})
	if err != nil {
		panic(err)
	}
	dd, err := sqs.OpenDedup("out/worker-dedup.txt")
	if err != nil {
		panic(err)
	}
	ledger, _ := os.OpenFile("out/worker-ledger.txt", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	var mu sync.Mutex

	pool := &sqs.Pool{Client: cl, URL: url, Concurrency: *conc, Wait: 2}
	pool.Handle = func(_ context.Context, m types.Message) error {
		var p sqs.Payment
		if err := json.Unmarshal([]byte(*m.Body), &p); err != nil {
			return err
		}
		if dd.Seen(p.PaymentID) {
			return nil
		}
		if !dd.Begin(p.PaymentID) {
			return fmt.Errorf("in flight elsewhere")
		}
		time.Sleep(400 * time.Millisecond) // the ledger write
		mu.Lock()
		fmt.Fprintf(ledger, "%s %d\n", p.PaymentID, p.AmountMinor)
		mu.Unlock()
		dd.Done(p.PaymentID)
		return nil
	}

	if *runFor > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, *runFor)
		defer cancel()
	}
	go func() {
		<-ctx.Done()
		s := &pool.Stats
		fmt.Printf("[%s] shutdown signal: received=%d, finished=%d, in flight right now=%d; draining\n", *name,
			s.Received.Load(), s.Processed.Load()+s.Failed.Load(), s.Received.Load()-s.Processed.Load()-s.Failed.Load())
	}()
	fmt.Printf("[%s] started, concurrency=%d\n", *name, *conc)
	pool.Run(ctx)
	s := &pool.Stats
	fmt.Printf("[%s] exited cleanly: received=%d processed=%d failed=%d deleted=%d\n", *name,
		s.Received.Load(), s.Processed.Load(), s.Failed.Load(), s.Deleted.Load())
}
