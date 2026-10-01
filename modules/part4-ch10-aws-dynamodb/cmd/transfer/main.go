// transfer: TransactWriteItems for a two-account transfer, cancellation
// reasons, and ClientRequestToken idempotency.
package main

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"awsdynamodb/ddb"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const table = "ddbsec-transfer"

var at = time.Date(2026, 10, 1, 9, 30, 0, 0, time.UTC)

// runID makes every token unique to this run. DynamoDB remembers a
// ClientRequestToken for ten minutes, even across a deleted and re-created
// table, so a fixed "tok-1" turns the second run of this program into a no-op.
var runID = strconv.FormatInt(time.Now().UnixNano(), 36)

func tok(n string) string { return "tok-" + n + "-" + runID }

func main() {
	ctx := context.Background()
	c, err := ddb.New(ctx)
	check(err)
	check(ddb.CreateTable(ctx, c, table))
	defer ddb.DeleteTable(ctx, c, table)
	put(ctx, c, ddb.NewAccount("alice", "Alice", 1000))
	put(ctx, c, ddb.NewAccount("bob", "Bob", 200))
	state(ctx, c, "start")

	step("A. alice -> bob 300, txid=tx-1, token=tok-1", ddb.Transfer(ctx, c, table, "alice", "bob", 300, "tx-1", tok("1"), at))
	state(ctx, c, "after A")

	step("B. the same call again (a retry after a timeout), same token tok-1", ddb.Transfer(ctx, c, table, "alice", "bob", 300, "tx-1", tok("1"), at))
	state(ctx, c, "after B (unchanged: the token made the retry a no-op)")

	step("C. same token tok-1 but amount 999 (a different request)", ddb.Transfer(ctx, c, table, "alice", "bob", 999, "tx-1", tok("1"), at))

	step("D. new token tok-2, SAME txid tx-1 (client forgot the token, kept the business id)", ddb.Transfer(ctx, c, table, "alice", "bob", 300, "tx-1", tok("2"), at))
	state(ctx, c, "after D (unchanged: the entry's attribute_not_exists condition refused the duplicate)")

	step("E. new token tok-3, NEW txid tx-2 (a genuinely new transfer)", ddb.Transfer(ctx, c, table, "alice", "bob", 300, "tx-2", tok("3"), at.Add(time.Minute)))
	state(ctx, c, "after E")

	step("F. alice -> bob 5000 (alice has 400): debit condition fails", ddb.Transfer(ctx, c, table, "alice", "bob", 5000, "tx-3", tok("4"), at.Add(2*time.Minute)))
	state(ctx, c, "after F (nothing moved, no entries written)")

	step("G. alice -> zed 50 (zed does not exist): credit condition fails", ddb.Transfer(ctx, c, table, "alice", "zed", 50, "tx-4", tok("5"), at.Add(3*time.Minute)))
	state(ctx, c, "after G (alice was NOT debited even though her own condition passed)")
}

func step(title string, err error) {
	fmt.Printf("\n%s\n", title)
	if err == nil {
		fmt.Println("  -> committed")
		return
	}
	var tc *types.TransactionCanceledException
	var mm *types.IdempotentParameterMismatchException
	switch {
	case errors.As(err, &tc):
		fmt.Println("  -> TransactionCanceledException; cancellation reasons, one per item in request order:")
		names := []string{"debit from", "credit to", "entry from", "entry to"}
		for i, r := range tc.CancellationReasons {
			fmt.Printf("     [%d] %-10s code=%-22s", i, names[i], aws.ToString(r.Code))
			if r.Message != nil {
				fmt.Printf(" msg=%q", aws.ToString(r.Message))
			}
			if len(r.Item) > 0 {
				var a ddb.Account
				if attributevalue.UnmarshalMap(r.Item, &a) == nil {
					fmt.Printf(" item.balance=%d", a.Balance)
				}
			}
			fmt.Println()
		}
	case errors.As(err, &mm):
		fmt.Printf("  -> IdempotentParameterMismatchException (code=%s, message=%q)\n", mm.ErrorCode(), strings.TrimSpace(mm.ErrorMessage()))
	default:
		fmt.Println("  -> other error:", err)
	}
}

func state(ctx context.Context, c *dynamodb.Client, label string) {
	fmt.Printf("  state %s:\n", label)
	for _, id := range []string{"alice", "bob"} {
		a, err := ddb.GetAccount(ctx, c, table, id, true)
		check(err)
		out, err := c.Query(ctx, &dynamodb.QueryInput{
			TableName: aws.String(table), ConsistentRead: aws.Bool(true),
			KeyConditionExpression:    aws.String("pk = :p AND begins_with(sk, :e)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":p": &types.AttributeValueMemberS{Value: ddb.AcctPK(id)}, ":e": &types.AttributeValueMemberS{Value: "ENT#"}},
		})
		check(err)
		var es []ddb.Entry
		check(attributevalue.UnmarshalListOfMaps(out.Items, &es))
		var parts []string
		for _, e := range es {
			parts = append(parts, fmt.Sprintf("%s:%+d", e.TxID, e.Amount))
		}
		fmt.Printf("    %-5s balance=%4d version=%d entries=[%s]\n", id, a.Balance, a.Version, strings.Join(parts, " "))
	}
}

func put(ctx context.Context, c *dynamodb.Client, a ddb.Account) {
	item, err := attributevalue.MarshalMap(a)
	check(err)
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table), Item: item})
	check(err)
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
