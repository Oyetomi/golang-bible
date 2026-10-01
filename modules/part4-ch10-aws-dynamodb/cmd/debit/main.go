// debit: 50 concurrent debits of 10 against an account holding 300.
// Compare the conditional write with the naive read-check-write.
package main

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"awsdynamodb/ddb"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

const (
	table   = "ddbsec-debit"
	workers = 50
	amt     = 10
	start   = 300
)

func main() {
	ctx := context.Background()
	c, err := ddb.New(ctx)
	check(err)
	check(ddb.CreateTable(ctx, c, table))
	defer ddb.DeleteTable(ctx, c, table)

	fmt.Printf("%d goroutines each debit %d from an account holding %d (demand %d, so %d can succeed)\n\n",
		workers, amt, start, workers*amt, start/amt)

	for _, mode := range []struct {
		name string
		fn   func(context.Context, *dynamodb.Client, string, string, int64) error
	}{{"conditional UpdateItem", ddb.Debit}, {"naive read-then-write", ddb.NaiveDebit}} {
		fmt.Println(mode.name)
		for trial := 1; trial <= 3; trial++ {
			reset(ctx, c)
			var ok, rejected, other atomic.Int64
			var wg sync.WaitGroup
			gate := make(chan struct{})
			for i := 0; i < workers; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					<-gate // release all goroutines together
					switch err := mode.fn(ctx, c, table, "alice", amt); {
					case err == nil:
						ok.Add(1)
					case errors.Is(err, ddb.ErrInsufficient):
						rejected.Add(1)
					default:
						other.Add(1)
						fmt.Println("  unexpected:", err)
					}
				}()
			}
			close(gate)
			wg.Wait()
			a, err := ddb.GetAccount(ctx, c, table, "alice", true)
			check(err)
			paid := ok.Load() * amt
			fmt.Printf("  trial %d: ok=%2d rejected=%2d  paid out=%3d  balance fell by=%3d  final=%4d  unrecorded debits=%d\n",
				trial, ok.Load(), rejected.Load(), paid, int64(start)-a.Balance, a.Balance, (paid-(int64(start)-a.Balance))/amt)
		}
		fmt.Println()
	}
}

func reset(ctx context.Context, c *dynamodb.Client) {
	item, err := attributevalue.MarshalMap(ddb.NewAccount("alice", "Alice", start))
	check(err)
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table), Item: item})
	check(err)
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
