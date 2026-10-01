// query: paginate 1,200 ledger entries with LastEvaluatedKey, then compare
// Query with Scan over a table holding ~6,000 items.
package main

import (
	"context"
	"fmt"
	"time"

	"awsdynamodb/ddb"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const table = "ddbsec-query"

var base = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

func main() {
	ctx := context.Background()
	c, err := ddb.New(ctx)
	check(err)
	check(ddb.CreateTable(ctx, c, table))
	defer ddb.DeleteTable(ctx, c, table)

	n := load(ctx, c, "alice", 1200) + 0
	for i := 0; i < 19; i++ {
		n += load(ctx, c, fmt.Sprintf("other%02d", i), 250)
	}
	fmt.Printf("loaded %d items: alice has 1200 entries, 19 other accounts have 250 each\n\n", n)

	pk := &types.AttributeValueMemberS{Value: ddb.AcctPK("alice")}
	vals := map[string]types.AttributeValue{":p": pk, ":e": &types.AttributeValueMemberS{Value: "ENT#"}}

	// 1. Paginated Query, 100 per page.
	var all []ddb.Entry
	var startKey map[string]types.AttributeValue
	pages, scanned := 0, int32(0)
	var cu float64
	t0 := time.Now()
	for {
		out, err := c.Query(ctx, &dynamodb.QueryInput{
			TableName: aws.String(table), Limit: aws.Int32(100), ExclusiveStartKey: startKey,
			KeyConditionExpression:    aws.String("pk = :p AND begins_with(sk, :e)"),
			ExpressionAttributeValues: vals, ReturnConsumedCapacity: types.ReturnConsumedCapacityTotal,
		})
		check(err)
		var es []ddb.Entry
		check(attributevalue.UnmarshalListOfMaps(out.Items, &es))
		all = append(all, es...)
		pages++
		scanned += out.ScannedCount
		cu += aws.ToFloat64(out.ConsumedCapacity.CapacityUnits)
		if pages <= 2 || out.LastEvaluatedKey == nil {
			fmt.Printf("  page %2d: %3d items, LastEvaluatedKey=%v\n", pages, len(es), keyStr(out.LastEvaluatedKey))
		}
		if startKey = out.LastEvaluatedKey; startKey == nil {
			break
		}
	}
	fmt.Printf("Query, Limit=100: %d pages, %d entries, scanned=%d, consumed=%.1f RCU, %v\n", pages, len(all), scanned, cu, time.Since(t0).Round(time.Millisecond))
	ordered := true
	for i := 1; i < len(all); i++ {
		ordered = ordered && all[i-1].SK < all[i].SK
	}
	fmt.Printf("  entries returned in sort-key (time) order: %v; first=%s last=%s\n\n", ordered, all[0].At.Format(time.RFC3339), all[len(all)-1].At.Format(time.RFC3339))

	// 2. Newest 10 only: the point of putting time in the sort key.
	t0 = time.Now()
	out, err := c.Query(ctx, &dynamodb.QueryInput{
		TableName: aws.String(table), Limit: aws.Int32(10), ScanIndexForward: aws.Bool(false),
		KeyConditionExpression:    aws.String("pk = :p AND begins_with(sk, :e)"),
		ExpressionAttributeValues: vals, ReturnConsumedCapacity: types.ReturnConsumedCapacityTotal,
	})
	check(err)
	fmt.Printf("Query newest 10 (ScanIndexForward=false, Limit=10): returned=%d scanned=%d consumed=%.1f RCU, %v\n\n",
		len(out.Items), out.ScannedCount, aws.ToFloat64(out.ConsumedCapacity.CapacityUnits), time.Since(t0).Round(time.Millisecond))

	// 3. Query, no Limit: DynamoDB's own 1 MB page cap decides.
	t0 = time.Now()
	pages, scanned, cu, got := 0, int32(0), 0.0, 0
	startKey = nil
	for {
		out, err := c.Query(ctx, &dynamodb.QueryInput{
			TableName: aws.String(table), ExclusiveStartKey: startKey,
			KeyConditionExpression:    aws.String("pk = :p AND begins_with(sk, :e)"),
			ExpressionAttributeValues: vals, ReturnConsumedCapacity: types.ReturnConsumedCapacityTotal,
		})
		check(err)
		pages++
		got += len(out.Items)
		scanned += out.ScannedCount
		cu += aws.ToFloat64(out.ConsumedCapacity.CapacityUnits)
		if startKey = out.LastEvaluatedKey; startKey == nil {
			break
		}
	}
	fmt.Printf("Query, no Limit:  %d page(s), %d entries, scanned=%d, consumed=%.1f RCU, %v\n", pages, got, scanned, cu, time.Since(t0).Round(time.Millisecond))

	// 4. Scan with a filter for the same 1,200 entries.
	t0 = time.Now()
	pages, scanned, cu, got = 0, 0, 0, 0
	startKey = nil
	for {
		out, err := c.Scan(ctx, &dynamodb.ScanInput{
			TableName: aws.String(table), ExclusiveStartKey: startKey,
			FilterExpression:          aws.String("pk = :p AND begins_with(sk, :e)"),
			ExpressionAttributeValues: vals, ReturnConsumedCapacity: types.ReturnConsumedCapacityTotal,
		})
		check(err)
		pages++
		got += len(out.Items)
		scanned += out.ScannedCount
		cu += aws.ToFloat64(out.ConsumedCapacity.CapacityUnits)
		if startKey = out.LastEvaluatedKey; startKey == nil {
			break
		}
	}
	fmt.Printf("Scan + filter:    %d page(s), %d entries returned, scanned=%d, consumed=%.1f RCU, %v\n", pages, got, scanned, cu, time.Since(t0).Round(time.Millisecond))
}

func keyStr(k map[string]types.AttributeValue) string {
	if k == nil {
		return "nil"
	}
	var m map[string]string
	_ = attributevalue.UnmarshalMap(k, &m)
	return fmt.Sprintf("{pk:%s sk:%s}", m["pk"], m["sk"])
}

// load writes an account plus n entries with BatchWriteItem (25 per call).
func load(ctx context.Context, c *dynamodb.Client, id string, n int) int {
	var reqs []types.WriteRequest
	add := func(v any) {
		item, err := attributevalue.MarshalMap(v)
		check(err)
		reqs = append(reqs, types.WriteRequest{PutRequest: &types.PutRequest{Item: item}})
	}
	add(ddb.NewAccount(id, id, 0))
	for i := 0; i < n; i++ {
		add(ddb.NewEntry(id, int64(i%7+1), fmt.Sprintf("tx-%s-%04d", id, i), base.Add(time.Duration(i)*time.Second)))
	}
	total := len(reqs)
	for len(reqs) > 0 {
		end := min(25, len(reqs))
		batch := reqs[:end]
		reqs = reqs[end:]
		for len(batch) > 0 { // BatchWriteItem may return UnprocessedItems; resend them
			out, err := c.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{RequestItems: map[string][]types.WriteRequest{table: batch}})
			check(err)
			batch = out.UnprocessedItems[table]
		}
	}
	return total
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
