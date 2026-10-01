// optimistic: 20 writers each add 5 to one account using read-modify-write
// guarded by a version attribute. Show conflicts, retries, and the exact total.
package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"awsdynamodb/ddb"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

const table = "ddbsec-optimistic"

func main() {
	ctx := context.Background()
	c, err := ddb.New(ctx)
	check(err)
	check(ddb.CreateTable(ctx, c, table))
	defer ddb.DeleteTable(ctx, c, table)
	item, _ := attributevalue.MarshalMap(ddb.NewAccount("alice", "Alice", 1000))
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table), Item: item})
	check(err)

	const writers = 20
	var retries atomic.Int64
	var wg sync.WaitGroup
	gate := make(chan struct{})
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-gate
			r, err := ddb.AdjustOptimistic(ctx, c, table, "alice", 5)
			check(err)
			retries.Add(int64(r))
		}()
	}
	close(gate)
	wg.Wait()
	a, err := ddb.GetAccount(ctx, c, table, "alice", true)
	check(err)
	fmt.Printf("%d writers each +5 on balance 1000, guarded by `version = :v`\n", writers)
	fmt.Printf("final balance=%d (expected %d), version=%d (expected %d), total retries after a conflict=%d\n",
		a.Balance, 1000+writers*5, a.Version, 1+writers, retries.Load())
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
