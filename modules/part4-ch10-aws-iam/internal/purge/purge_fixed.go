//go:build !buggy

package purge

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Prefix deletes every object whose key starts with prefix and returns how
// many it deleted. It follows ListObjectsV2 continuation tokens (S3 returns
// at most 1000 keys per page) and checks the per-key errors that
// DeleteObjects reports inside a 200 OK.
func Prefix(ctx context.Context, c S3, bucket, prefix string) (int, error) {
	deleted := 0
	var token *string
	for {
		page, err := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket: aws.String(bucket), Prefix: aws.String(prefix), ContinuationToken: token,
		})
		if err != nil {
			return deleted, fmt.Errorf("list %s/%s: %w", bucket, prefix, err)
		}
		if len(page.Contents) > 0 {
			ids := make([]types.ObjectIdentifier, len(page.Contents))
			for i, o := range page.Contents {
				ids[i] = types.ObjectIdentifier{Key: o.Key}
			}
			out, err := c.DeleteObjects(ctx, &s3.DeleteObjectsInput{
				Bucket: aws.String(bucket), Delete: &types.Delete{Objects: ids, Quiet: aws.Bool(true)},
			})
			if err != nil {
				return deleted, fmt.Errorf("delete batch: %w", err)
			}
			if len(out.Errors) > 0 {
				e := out.Errors[0]
				return deleted, fmt.Errorf("delete %s: %s (%d of %d keys failed)", aws.ToString(e.Key), aws.ToString(e.Code), len(out.Errors), len(ids))
			}
			deleted += len(ids)
		}
		if !aws.ToBool(page.IsTruncated) {
			return deleted, nil
		}
		token = page.NextContinuationToken
	}
}
