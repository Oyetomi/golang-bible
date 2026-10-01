// dlq: a poison message, maxReceiveCount=3, and the move to the dead-letter queue.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"sqssec/sqs"
)

func main() {
	ctx := context.Background()
	cl, _, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	defer sqs.Cleanup(cl, "dlq")

	dlq, _ := sqs.CreateQueue(ctx, cl, "dlq-dead", nil)
	arn, _ := sqs.QueueARN(ctx, cl, dlq)
	redrive, _ := json.Marshal(map[string]any{"deadLetterTargetArn": arn, "maxReceiveCount": 3})
	main, err := sqs.CreateQueue(ctx, cl, "dlq-main", map[string]string{
		"VisibilityTimeout": "2",
		"RedrivePolicy":     string(redrive),
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("redrive policy: %s\n", redrive)

	sqs.Send(ctx, cl, main, sqs.Payment{PaymentID: "p-good", Account: "acct-1", AmountMinor: 500, Currency: "USD"})
	// The poison: a payment in a currency the ledger cannot book. It will
	// fail on every attempt, forever, unless something stops it.
	sqs.Send(ctx, cl, main, sqs.Payment{PaymentID: "p-poison", Account: "acct-2", AmountMinor: -1, Currency: "???"})

	handle := func(p sqs.Payment) error {
		if p.Currency == "???" {
			return errors.New("unknown currency")
		}
		return nil
	}

	t0 := time.Now()
	for time.Since(t0) < 12*time.Second {
		msgs, err := sqs.Receive(ctx, cl, main, 10, 1)
		if err != nil {
			panic(err)
		}
		for _, m := range msgs {
			var p sqs.Payment
			json.Unmarshal([]byte(*m.Body), &p)
			rc := m.Attributes["ApproximateReceiveCount"]
			if err := handle(p); err != nil {
				fmt.Printf("t+%4.1fs %-9s ReceiveCount=%s FAILED (%v): not deleting\n", time.Since(t0).Seconds(), p.PaymentID, rc, err)
				continue
			}
			sqs.Delete(ctx, cl, main, m)
			fmt.Printf("t+%4.1fs %-9s ReceiveCount=%s ok, deleted\n", time.Since(t0).Seconds(), p.PaymentID, rc)
		}
	}
	v, f, _ := sqs.Depth(ctx, cl, main)
	fmt.Printf("main queue: visible=%s in-flight=%s\n", v, f)
	dm, err := sqs.Receive(ctx, cl, dlq, 10, 1)
	if err != nil {
		panic(err)
	}
	for _, m := range dm {
		fmt.Printf("DLQ holds: %s (ReceiveCount on DLQ=%s)\n", *m.Body, m.Attributes["ApproximateReceiveCount"])
	}
}
