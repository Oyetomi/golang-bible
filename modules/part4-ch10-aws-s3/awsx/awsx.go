// Package awsx is the one place the chapter builds an S3 client.
package awsx

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// New loads the default config (env, shared files, IMDS ...) and builds an S3
// client. Where the requests go is NOT set here: with AWS_ENDPOINT_URL in the
// environment the SDK itself redirects every service. Against real AWS the
// variable is simply unset and this code is unchanged.
func New(ctx context.Context, opts ...func(*config.LoadOptions) error) (*s3.Client, aws.Config, error) {
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, cfg, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		// LocalStack serves buckets at http://host:4566/bucket/key, not
		// http://bucket.host:4566/key. Harmless against real AWS.
		o.UsePathStyle = true
	})
	return client, cfg, nil
}
