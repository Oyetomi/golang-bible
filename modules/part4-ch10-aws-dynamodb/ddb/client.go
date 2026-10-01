// Package ddb holds the small amount of DynamoDB plumbing every program in
// this section shares: a client pointed at LocalStack (or real AWS) and
// helpers to create and delete a table.
package ddb

import (
	"context"
	"errors"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// New builds a client. With AWS_ENDPOINT_URL set (LocalStack) the SDK sends
// every call there; unset, it talks to real AWS with the normal credential chain.
func New(ctx context.Context) (*dynamodb.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(envOr("AWS_REGION", "us-east-1")))
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg), nil // honours AWS_ENDPOINT_URL natively
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

// CreateTable makes a single-table ledger: string pk + string sk, on-demand.
func CreateTable(ctx context.Context, c *dynamodb.Client, name string) error {
	_, err := c.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String(name),
		AttributeDefinitions: []types.AttributeDefinition{
			{AttributeName: aws.String("pk"), AttributeType: types.ScalarAttributeTypeS},
			{AttributeName: aws.String("sk"), AttributeType: types.ScalarAttributeTypeS},
		},
		KeySchema: []types.KeySchemaElement{
			{AttributeName: aws.String("pk"), KeyType: types.KeyTypeHash},
			{AttributeName: aws.String("sk"), KeyType: types.KeyTypeRange},
		},
		BillingMode: types.BillingModePayPerRequest,
	})
	var inUse *types.ResourceInUseException
	if errors.As(err, &inUse) {
		return nil
	}
	if err != nil {
		return err
	}
	return dynamodb.NewTableExistsWaiter(c).Wait(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(name)}, 30e9)
}

func DeleteTable(ctx context.Context, c *dynamodb.Client, name string) {
	_, _ = c.DeleteTable(ctx, &dynamodb.DeleteTableInput{TableName: aws.String(name)})
}
