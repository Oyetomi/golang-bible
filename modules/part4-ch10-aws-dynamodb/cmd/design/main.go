// design: marshal Go structs into DynamoDB items and hit the pitfalls on purpose.
package main

import (
	"context"
	"fmt"
	"sort"
	"time"

	"awsdynamodb/ddb"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const table = "ddbsec-design"

func show(label string, item map[string]types.AttributeValue) {
	names := make([]string, 0, len(item))
	for k := range item {
		names = append(names, k)
	}
	sort.Strings(names)
	fmt.Printf("%s\n", label)
	for _, k := range names {
		switch v := item[k].(type) {
		case *types.AttributeValueMemberS:
			fmt.Printf("  %-8s S    %q\n", k, v.Value)
		case *types.AttributeValueMemberN:
			fmt.Printf("  %-8s N    %s\n", k, v.Value)
		case *types.AttributeValueMemberNULL:
			fmt.Printf("  %-8s NULL\n", k)
		default:
			fmt.Printf("  %-8s %T\n", k, v)
		}
	}
}

// Account2 is the naive struct: omitempty on the balance.
type Account2 struct {
	PK      string   `dynamodbav:"pk"`
	SK      string   `dynamodbav:"sk"`
	Balance int64    `dynamodbav:"balance,omitempty"`
	Memo    string   `dynamodbav:"memo"`
	Tags    []string `dynamodbav:"tags"`
}

func main() {
	ctx := context.Background()
	c, err := ddb.New(ctx)
	check(err)
	check(ddb.CreateTable(ctx, c, table))
	defer ddb.DeleteTable(ctx, c, table)

	at := time.Date(2026, 10, 1, 9, 30, 0, 0, time.UTC)
	e := ddb.NewEntry("alice", -2500, "tx-001", at)
	item, err := attributevalue.MarshalMap(e)
	check(err)
	show("1. Entry with Memo empty (omitempty) and time.Time:", item)

	a2 := Account2{PK: "ACCT#bob", SK: "ACCT", Balance: 0}
	item, err = attributevalue.MarshalMap(a2)
	check(err)
	show("\n2. Account2{Balance: 0} with `omitempty`, Memo \"\" and nil Tags:", item)

	// Pitfall: the zero balance vanished from the item. Store it and ask DynamoDB.
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table), Item: item})
	check(err)
	_, err = c.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(table), Key: keyOf("ACCT#bob"),
		ConditionExpression:       aws.String("balance >= :z"),
		UpdateExpression:          aws.String("SET memo = :m"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":z": &types.AttributeValueMemberN{Value: "0"}, ":m": &types.AttributeValueMemberS{Value: "x"}},
	})
	fmt.Printf("\n3. condition `balance >= 0` on the stored zero-balance account -> ccf=%v\n", ddb.IsConditionFailed(err))

	// Pitfall: empty string in a KEY attribute.
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table),
		Item: map[string]types.AttributeValue{"pk": &types.AttributeValueMemberS{Value: ""}, "sk": &types.AttributeValueMemberS{Value: "ACCT"}}})
	fmt.Printf("\n4. PutItem with pk = \"\":\n   %v\n", err)

	// Empty string in a non-key attribute is accepted by DynamoDB since 2020.
	_, err = c.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(table),
		Item: map[string]types.AttributeValue{"pk": &types.AttributeValueMemberS{Value: "ACCT#c"}, "sk": &types.AttributeValueMemberS{Value: "ACCT"}, "memo": &types.AttributeValueMemberS{Value: ""}}})
	fmt.Printf("\n5. PutItem with memo = \"\" (non-key): err=%v\n", err)

	// Round trip: what comes back for the omitted attribute.
	out, err := c.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(table), Key: keyOf("ACCT#bob")})
	check(err)
	var back Account2
	check(attributevalue.UnmarshalMap(out.Item, &back))
	fmt.Printf("\n6. round trip of Account2{Balance: 0}: Balance=%d, attribute present in item: %v\n", back.Balance, out.Item["balance"] != nil)
}

func keyOf(pk string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{"pk": &types.AttributeValueMemberS{Value: pk}, "sk": &types.AttributeValueMemberS{Value: "ACCT"}}
}
func check(err error) {
	if err != nil {
		panic(err)
	}
}
