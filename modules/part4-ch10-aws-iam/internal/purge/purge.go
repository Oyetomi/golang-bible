// Package purge deletes every object under a key prefix. It depends on a
// two-method slice of the S3 client, not on *s3.Client, so tests can swap it.
package purge

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

//go:generate go run go.uber.org/mock/mockgen -source=purge.go -destination=mock_s3_test.go -package=purge

// S3 is the consumer-side interface: only what Prefix calls. *s3.Client
// satisfies it with no adapter.
type S3 interface {
	ListObjectsV2(ctx context.Context, in *s3.ListObjectsV2Input, opts ...func(*s3.Options)) (*s3.ListObjectsV2Output, error)
	DeleteObjects(ctx context.Context, in *s3.DeleteObjectsInput, opts ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
}
