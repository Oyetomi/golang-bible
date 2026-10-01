// redeliver: at-least-once, for real. The parent starts a child process that
// receives the message and dies with os.Exit before it can delete; the parent
// then measures when the message comes back.
package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	awssqs "github.com/aws/aws-sdk-go-v2/service/sqs"

	"sqssec/sqs"
)

const visibility = 5 // seconds, configured on the queue

func main() {
	ctx := context.Background()
	cl, _, err := sqs.New(ctx)
	if err != nil {
		panic(err)
	}
	if len(os.Args) == 3 && os.Args[1] == "crash" {
		crash(ctx, cl, os.Args[2])
	}
	url, err := sqs.CreateQueue(ctx, cl, "redeliver", map[string]string{"VisibilityTimeout": fmt.Sprint(visibility)})
	if err != nil {
		panic(err)
	}
	defer sqs.Cleanup(cl, "redeliver")
	sqs.Send(ctx, cl, url, sqs.Payment{PaymentID: "p-100", Account: "acct-7", AmountMinor: 99900, Currency: "USD"})

	// Consumer A: a separate process that crashes after receive, before delete.
	out, err := exec.Command(os.Args[0], "crash", url).Output()
	fmt.Print(string(out))
	fmt.Printf("consumer A exited: %v\n", err)
	var receivedAt time.Time
	var firstID string
	sc := bufio.NewScanner(strings.NewReader(string(out)))
	for sc.Scan() {
		if f := strings.Fields(sc.Text()); len(f) == 3 && f[0] == "RECEIVED" {
			ns, _ := strconv.ParseInt(f[1], 10, 64)
			receivedAt, firstID = time.Unix(0, ns), f[2]
		}
	}

	// Consumer B: a healthy consumer with long polling, knowing nothing of A.
	for {
		got, err := sqs.Receive(ctx, cl, url, 1, 20)
		if err != nil {
			panic(err)
		}
		if len(got) == 0 {
			continue
		}
		delay := time.Since(receivedAt)
		fmt.Printf("consumer B received it: same MessageId=%t ReceiveCount=%s body=%s\n",
			*got[0].MessageId == firstID, got[0].Attributes["ApproximateReceiveCount"], *got[0].Body)
		fmt.Printf("redelivered %.2fs after consumer A received it (queue VisibilityTimeout=%ds)\n", delay.Seconds(), visibility)
		sqs.Delete(ctx, cl, url, got[0])
		v, f, _ := sqs.Depth(ctx, cl, url)
		fmt.Printf("after B deletes: visible=%s in-flight=%s\n", v, f)
		return
	}
}

// crash is consumer A: receive, begin work, die. No Delete, no cleanup.
func crash(ctx context.Context, cl *awssqs.Client, url string) {
	msgs, err := sqs.Receive(ctx, cl, url, 1, 5)
	if err != nil || len(msgs) == 0 {
		fmt.Println("consumer A: nothing received", err)
		os.Exit(2)
	}
	fmt.Printf("RECEIVED %d %s\n", time.Now().UnixNano(), *msgs[0].MessageId)
	fmt.Printf("consumer A: got %s (ReceiveCount=%s), crashing before delete\n",
		*msgs[0].Body, msgs[0].Attributes["ApproximateReceiveCount"])
	os.Exit(1)
}
