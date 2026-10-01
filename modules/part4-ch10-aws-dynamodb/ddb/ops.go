package ddb

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var ErrInsufficient = errors.New("insufficient funds")

// IsConditionFailed reports whether err is DynamoDB saying "your
// ConditionExpression was false". errors.As, because the SDK wraps errors.
func IsConditionFailed(err error) bool {
	var ccf *types.ConditionalCheckFailedException
	return errors.As(err, &ccf)
}

func key(id string) map[string]types.AttributeValue {
	k, _ := attributevalue.MarshalMap(AccountKey(id))
	return k
}

// Debit subtracts amt atomically, inside DynamoDB, only if balance >= amt.
// The check and the write are ONE operation on the server: nothing can
// interleave between them.
func Debit(ctx context.Context, c *dynamodb.Client, table, id string, amt int64) error {
	cond := expression.Name("balance").GreaterThanEqual(expression.Value(amt))
	upd := expression.Set(expression.Name("balance"), expression.Name("balance").Minus(expression.Value(amt))).
		Add(expression.Name("version"), expression.Value(1))
	expr, err := expression.NewBuilder().WithCondition(cond).WithUpdate(upd).Build()
	if err != nil {
		return err
	}
	_, err = c.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(table), Key: key(id),
		ConditionExpression:       expr.Condition(),
		UpdateExpression:          expr.Update(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if IsConditionFailed(err) {
		return ErrInsufficient
	}
	return err
}

func GetAccount(ctx context.Context, c *dynamodb.Client, table, id string, consistent bool) (Account, error) {
	out, err := c.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(table), Key: key(id), ConsistentRead: aws.Bool(consistent)})
	if err != nil {
		return Account{}, err
	}
	var a Account
	return a, attributevalue.UnmarshalMap(out.Item, &a)
}

// NaiveDebit is what you write first: read, check in Go, write the new value.
// The check is correct at the moment of the read and stale by the time of the write.
func NaiveDebit(ctx context.Context, c *dynamodb.Client, table, id string, amt int64) error {
	a, err := GetAccount(ctx, c, table, id, true) // even a strongly consistent read doesn't help
	if err != nil {
		return err
	}
	if a.Balance < amt {
		return ErrInsufficient
	}
	_, err = c.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(table), Key: key(id),
		UpdateExpression:          aws.String("SET balance = :b"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":b": &types.AttributeValueMemberN{Value: itoa(a.Balance - amt)}},
	})
	return err
}

// AdjustOptimistic is read-modify-write made safe by a version attribute:
// the write only lands if nobody changed the item since we read it.
// It returns how many times it had to retry.
func AdjustOptimistic(ctx context.Context, c *dynamodb.Client, table, id string, delta int64) (retries int, err error) {
	for {
		a, err := GetAccount(ctx, c, table, id, true)
		if err != nil {
			return retries, err
		}
		_, err = c.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: aws.String(table), Key: key(id),
			ConditionExpression: aws.String("version = :v"),
			UpdateExpression:    aws.String("SET balance = :b, version = :n"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":v": &types.AttributeValueMemberN{Value: itoa(a.Version)},
				":b": &types.AttributeValueMemberN{Value: itoa(a.Balance + delta)},
				":n": &types.AttributeValueMemberN{Value: itoa(a.Version + 1)},
			},
		})
		if IsConditionFailed(err) {
			retries++
			continue
		}
		return retries, err
	}
}

// Transfer moves amt from -> to in ONE transaction: debit (guarded), credit
// (guarded: the account must exist), and one ledger entry per side. All four
// writes commit or none do. token makes a retry of the same call a no-op.
func Transfer(ctx context.Context, c *dynamodb.Client, table, from, to string, amt int64, txid, token string, at time.Time) error {
	debit := &types.Update{
		TableName: aws.String(table), Key: key(from),
		ConditionExpression:                 aws.String("balance >= :amt"),
		UpdateExpression:                    aws.String("SET balance = balance - :amt ADD version :one"),
		ExpressionAttributeValues:           amtVals(amt),
		ReturnValuesOnConditionCheckFailure: types.ReturnValuesOnConditionCheckFailureAllOld,
	}
	credit := &types.Update{
		TableName: aws.String(table), Key: key(to),
		ConditionExpression:       aws.String("attribute_exists(pk)"),
		UpdateExpression:          aws.String("SET balance = balance + :amt ADD version :one"),
		ExpressionAttributeValues: amtVals(amt),
	}
	eFrom, _ := attributevalue.MarshalMap(NewEntry(from, -amt, txid, at))
	eTo, _ := attributevalue.MarshalMap(NewEntry(to, amt, txid, at))
	_, err := c.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		ClientRequestToken: aws.String(token),
		TransactItems: []types.TransactWriteItem{
			{Update: debit}, {Update: credit},
			{Put: &types.Put{TableName: aws.String(table), Item: eFrom, ConditionExpression: aws.String("attribute_not_exists(pk)")}},
			{Put: &types.Put{TableName: aws.String(table), Item: eTo, ConditionExpression: aws.String("attribute_not_exists(pk)")}},
		},
	})
	return err
}

func amtVals(amt int64) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		":amt": &types.AttributeValueMemberN{Value: itoa(amt)},
		":one": &types.AttributeValueMemberN{Value: "1"},
	}
}

func itoa(n int64) string { return formatInt(n) }
