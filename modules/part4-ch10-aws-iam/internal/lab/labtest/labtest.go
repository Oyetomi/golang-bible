// Package labtest is the testing helper: it finds the endpoint, makes
// uniquely named resources, and registers t.Cleanup to remove them.
package labtest

import (
	"context"
	"net"
	"net/url"
	"os"
	"testing"
	"time"

	"awsiam/internal/lab"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3 returns a client built by the same lab.Load production code uses.
// The endpoint comes from AWS_ENDPOINT_URL. If nothing is listening there the
// test is skipped, unless REQUIRE_AWS=1, which makes it fail instead so CI
// can never go green by skipping everything.
func S3(t *testing.T) *s3.Client {
	t.Helper()
	ep := os.Getenv("AWS_ENDPOINT_URL")
	if ep == "" {
		skipOrFail(t, "AWS_ENDPOINT_URL is not set")
	}
	u, err := url.Parse(ep)
	if err != nil {
		t.Fatalf("bad AWS_ENDPOINT_URL %q: %v", ep, err)
	}
	conn, err := net.DialTimeout("tcp", u.Host, time.Second)
	if err != nil {
		skipOrFail(t, "nothing listening on "+u.Host)
	}
	conn.Close()
	cfg, err := lab.Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return s3.NewFromConfig(cfg)
}

func skipOrFail(t *testing.T, why string) {
	t.Helper()
	if os.Getenv("REQUIRE_AWS") == "1" {
		t.Fatalf("REQUIRE_AWS=1 but %s", why)
	}
	t.Skip(why)
}

// Bucket creates iamsec-<testname>-<random> and deletes it, and everything in
// it, when the test ends. Every parallel subtest gets its own bucket, so no
// test can see another's keys.
func Bucket(t *testing.T, c *s3.Client) string {
	t.Helper()
	ctx := context.Background()
	name := lab.Name(t.Name())
	if _, err := c.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(name)}); err != nil {
		t.Fatalf("create bucket %s: %v", name, err)
	}
	t.Cleanup(func() {
		p := s3.NewListObjectsV2Paginator(c, &s3.ListObjectsV2Input{Bucket: aws.String(name)})
		for p.HasMorePages() {
			pg, err := p.NextPage(ctx)
			if err != nil {
				t.Errorf("cleanup list %s: %v", name, err)
				return
			}
			for _, o := range pg.Contents {
				c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(name), Key: o.Key})
			}
		}
		if _, err := c.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(name)}); err != nil {
			t.Errorf("cleanup delete bucket %s: %v", name, err)
		}
	})
	return name
}
