// Typed errors and retries.
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync/atomic"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"awss3/awsx"
)

func must(err error) {
	if err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
}

// flaky answers 503 for the first n requests, then passes through.
type flaky struct {
	next  http.RoundTripper
	fail  int64
	calls atomic.Int64
}

func (f *flaky) RoundTrip(r *http.Request) (*http.Response, error) {
	if f.calls.Add(1) <= f.fail {
		return &http.Response{
			StatusCode: 503, Status: "503 Slow Down", Proto: "HTTP/1.1", ProtoMajor: 1, ProtoMinor: 1,
			Header: http.Header{"Content-Type": []string{"application/xml"}},
			Body:   http.NoBody, Request: r,
		}, nil
	}
	return f.next.RoundTrip(r)
}

func main() {
	ctx := context.Background()
	client, cfg, err := awsx.New(ctx)
	must(err)
	bucket := "s3sec-errors"
	_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
	must(err)
	defer client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})

	// 1. Missing key: GetObject returns the typed *types.NoSuchKey.
	_, err = client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String("nope")})
	var nsk *types.NoSuchKey
	fmt.Println("GetObject missing key")
	fmt.Println("  errors.As(*types.NoSuchKey):", errors.As(err, &nsk))
	var ae smithy.APIError
	if errors.As(err, &ae) {
		fmt.Printf("  smithy.APIError code=%q message=%q fault=%v\n", ae.ErrorCode(), ae.ErrorMessage(), ae.ErrorFault())
	}

	// 2. HeadObject on a missing key: no body to parse -> NOT NoSuchKey.
	_, err = client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(bucket), Key: aws.String("nope")})
	fmt.Println("HeadObject missing key")
	fmt.Println("  errors.As(*types.NoSuchKey):", errors.As(err, &nsk))
	fmt.Println("  errors.As(*types.NotFound): ", func() bool { var nf *types.NotFound; return errors.As(err, &nf) }())
	if errors.As(err, &ae) {
		fmt.Printf("  smithy.APIError code=%q\n", ae.ErrorCode())
	}

	// 3. Missing bucket.
	_, err = client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: aws.String("s3sec-no-such-bucket")})
	var nsb *types.NoSuchBucket
	fmt.Println("ListObjectsV2 missing bucket")
	fmt.Println("  errors.As(*types.NoSuchBucket):", errors.As(err, &nsb))

	// 4. Retries. Default retryer: standard mode, 3 attempts total.
	r := retry.NewStandard()
	fmt.Printf("default retryer: MaxAttempts()=%d MaxBackoff default=%v\n", r.MaxAttempts(), retry.DefaultMaxBackoff)

	for _, fail := range []int64{2, 5} {
		ft := &flaky{next: http.DefaultTransport, fail: fail}
		c2 := cfg.Copy()
		c2.HTTPClient = &http.Client{Transport: ft}
		cl := s3.NewFromConfig(c2, func(o *s3.Options) { o.UsePathStyle = true })
		_, err := cl.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: aws.String(bucket)})
		var re *retry.MaxAttemptsError
		fmt.Printf("server fails first %d requests -> HTTP calls made=%d\n", fail, ft.calls.Load())
		if err == nil {
			fmt.Println("  result: success")
		} else {
			msg := err.Error()
			if len(msg) > 150 {
				msg = msg[:150] + "..."
			}
			fmt.Println("  result: error:", strings.ReplaceAll(msg, "\n", " "))
			if errors.As(err, &re) {
				fmt.Println("  errors.As(*retry.MaxAttemptsError): true, attempts =", re.Attempt)
			}
		}
	}
}
