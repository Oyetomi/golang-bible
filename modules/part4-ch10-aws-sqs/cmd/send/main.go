// send: queue admin for the SIGTERM demo.  send create | send N | send depth | send cleanup
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"sqssec/sqs"
)

func main() {
	ctx := context.Background()
	cl, _, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	url, err := sqs.CreateQueue(ctx, cl, "worker", map[string]string{"VisibilityTimeout": "10"})
	if err != nil {
		panic(err)
	}
	switch os.Args[1] {
	case "cleanup":
		sqs.Cleanup(cl, "worker")
	case "depth":
		v, f, _ := sqs.Depth(ctx, cl, url)
		fmt.Printf("queue depth: visible=%s in-flight=%s\n", v, f)
	default:
		n, _ := strconv.Atoi(os.Args[1])
		for i := 1; i <= n; i++ {
			err := sqs.Send(ctx, cl, url, sqs.Payment{PaymentID: fmt.Sprintf("p-%03d", i), Account: "acct-1", AmountMinor: int64(100 * i), Currency: "USD"})
			if err != nil {
				panic(err)
			}
		}
		fmt.Printf("sent %d payments\n", n)
	}
}
