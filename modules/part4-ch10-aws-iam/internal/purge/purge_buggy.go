//go:build buggy

package purge

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Prefix is the first draft: list once, delete what came back. It reads fine
// and it passes a one-page mock. It silently leaves everything after key 1000.
func Prefix(ctx context.Context, c S3, bucket, prefix string) (int, error) {
	page, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: aws.String(bucket), Prefix: aws.String(prefix)})
	if err != nil {
		return 0, fmt.Errorf("list %s/%s: %w", bucket, prefix, err)
	}
	if len(page.Contents) == 0 {
		return 0, nil
	}
	ids := make([]types.ObjectIdentifier, len(page.Contents))
	for i, o := range page.Contents {
		ids[i] = types.ObjectIdentifier{Key: o.Key}
	}
	_, err = c.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: aws.String(bucket), Delete: &types.Delete{Objects: ids, Quiet: aws.Bool(true)}})
	return len(ids), err
}
