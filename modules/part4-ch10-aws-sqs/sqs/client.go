// Package sqs holds the small helpers every program in this section shares:
// a LocalStack-aware client that counts real HTTP calls, queue helpers and the
// payment event the ledger consumes.
package sqs

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync/atomic"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	awssqs "github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

// Payment is the event body: one ledger movement.
type Payment struct {
	PaymentID   string `json:"payment_id"`
	Account     string `json:"account"`
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
}

// Calls counts every HTTP request the client sends: the number AWS bills for.
type Calls struct{ n atomic.Int64 }

func (c *Calls) N() int64 { return c.n.Load() }

type counting struct {
	c    *Calls
	next http.RoundTripper
}

func (t counting) RoundTrip(r *http.Request) (*http.Response, error) {
	t.c.n.Add(1)
	return t.next.RoundTrip(r)
}

// New builds an SQS client. SQS_ENDPOINT points it at LocalStack; unset, it
// talks to real AWS with the default credential chain.
func New(ctx context.Context) (*awssqs.Client, *Calls, error) {
	calls := &Calls{}
	opts := []func(*config.LoadOptions) error{
		config.WithRegion("us-east-1"),
		config.WithHTTPClient(&http.Client{Transport: counting{calls, http.DefaultTransport}}),
	}
	endpoint := os.Getenv("SQS_ENDPOINT")
	if endpoint != "" {
		opts = append(opts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("test", "test", "")))
	}
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, nil, err
	}
	cl := awssqs.NewFromConfig(cfg, func(o *awssqs.Options) {
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
		}
	})
	return cl, calls, nil
}

// CreateQueue creates a queue named sqssec-<name> and returns its URL.
func CreateQueue(ctx context.Context, cl *awssqs.Client, name string, attrs map[string]string) (string, error) {
	out, err := cl.CreateQueue(ctx, &awssqs.CreateQueueInput{QueueName: aws.String("sqssec-" + name), Attributes: attrs})
	if err != nil {
		return "", err
	}
	return *out.QueueUrl, nil
}

// QueueARN reads a queue's ARN (needed for the redrive policy).
func QueueARN(ctx context.Context, cl *awssqs.Client, url string) (string, error) {
	out, err := cl.GetQueueAttributes(ctx, &awssqs.GetQueueAttributesInput{
		QueueUrl: aws.String(url), AttributeNames: []types.QueueAttributeName{types.QueueAttributeNameQueueArn}})
	if err != nil {
		return "", err
	}
	return out.Attributes["QueueArn"], nil
}

// Depth returns visible and in-flight message counts.
func Depth(ctx context.Context, cl *awssqs.Client, url string) (visible, inflight string, err error) {
	out, err := cl.GetQueueAttributes(ctx, &awssqs.GetQueueAttributesInput{
		QueueUrl: aws.String(url), AttributeNames: []types.QueueAttributeName{
			types.QueueAttributeNameApproximateNumberOfMessages,
			types.QueueAttributeNameApproximateNumberOfMessagesNotVisible}})
	if err != nil {
		return "", "", err
	}
	return out.Attributes["ApproximateNumberOfMessages"], out.Attributes["ApproximateNumberOfMessagesNotVisible"], nil
}

// Send publishes one payment event.
func Send(ctx context.Context, cl *awssqs.Client, url string, p Payment) error {
	b, _ := json.Marshal(p)
	_, err := cl.SendMessage(ctx, &awssqs.SendMessageInput{QueueUrl: aws.String(url), MessageBody: aws.String(string(b))})
	return err
}

// Receive polls once. wait is WaitTimeSeconds: 0 = short poll, >0 = long poll.
func Receive(ctx context.Context, cl *awssqs.Client, url string, max, wait int32) ([]types.Message, error) {
	out, err := cl.ReceiveMessage(ctx, &awssqs.ReceiveMessageInput{
		QueueUrl:                    aws.String(url),
		MaxNumberOfMessages:         max,
		WaitTimeSeconds:             wait,
		MessageSystemAttributeNames: []types.MessageSystemAttributeName{types.MessageSystemAttributeNameAll},
	})
	if err != nil {
		return nil, err
	}
	return out.Messages, nil
}

// Delete removes a message for good: the only thing that does.
func Delete(ctx context.Context, cl *awssqs.Client, url string, m types.Message) error {
	_, err := cl.DeleteMessage(ctx, &awssqs.DeleteMessageInput{QueueUrl: aws.String(url), ReceiptHandle: m.ReceiptHandle})
	return err
}

// Cleanup deletes every queue whose name starts with sqssec-<prefix>.
func Cleanup(cl *awssqs.Client, prefix string) {
	ctx := context.Background()
	out, err := cl.ListQueues(ctx, &awssqs.ListQueuesInput{QueueNamePrefix: aws.String("sqssec-" + prefix)})
	if err != nil {
		return
	}
	for _, u := range out.QueueUrls {
		cl.DeleteQueue(ctx, &awssqs.DeleteQueueInput{QueueUrl: aws.String(u)})
	}
}
