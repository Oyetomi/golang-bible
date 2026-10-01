package sqs

import (
	"context"
	"sync"
	"sync/atomic"

	awssqs "github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

// Handler processes one message. Returning nil means "safe to delete".
type Handler func(ctx context.Context, m types.Message) error

// Stats are the counters a shutdown report is built from.
type Stats struct {
	Received, Processed, Failed, Deleted atomic.Int64
}

// Pool is a bounded-concurrency consumer: at most Concurrency messages are in
// flight, and Run returns only after every received message was handled.
type Pool struct {
	Client      *awssqs.Client
	URL         string
	Concurrency int
	Wait        int32 // long-poll seconds
	Handle      Handler
	Stats       Stats
}

// Run polls until ctx is cancelled (SIGTERM), then drains in-flight work.
func (p *Pool) Run(ctx context.Context) {
	slots := make(chan struct{}, p.Concurrency)
	var wg sync.WaitGroup
	// Work runs on its own context: cancelling ctx stops *receiving*, never
	// the handlers or their deletes.
	work := context.WithoutCancel(ctx)
	for ctx.Err() == nil {
		// Reserve a slot first, so we never receive more than we can start.
		select {
		case slots <- struct{}{}:
		case <-ctx.Done():
			break
		}
		if ctx.Err() != nil {
			break
		}
		n := 1
		for n < 10 && n < p.Concurrency {
			select {
			case slots <- struct{}{}:
				n++
				continue
			default:
			}
			break
		}
		msgs, err := Receive(ctx, p.Client, p.URL, int32(n), p.Wait)
		for i := len(msgs); i < n; i++ {
			<-slots // give back slots we did not use
		}
		if err != nil {
			continue // ctx cancelled mid-poll, or a transient error: loop re-checks ctx
		}
		for _, m := range msgs {
			p.Stats.Received.Add(1)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { <-slots }()
				if err := p.Handle(work, m); err != nil {
					p.Stats.Failed.Add(1) // no delete: SQS redelivers after the visibility timeout
					return
				}
				p.Stats.Processed.Add(1)
				if err := Delete(work, p.Client, p.URL, m); err == nil {
					p.Stats.Deleted.Add(1)
				}
			}()
		}
	}
	wg.Wait()
}
