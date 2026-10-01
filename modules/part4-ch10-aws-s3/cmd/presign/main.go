// A presigned GET URL, fetched with plain net/http: valid, tampered, expired.
package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"awss3/awsx"
)

func must(err error) {
	if err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
}

func fetch(label, url string) {
	resp, err := http.Get(url) // no SDK, no credentials: the URL is the credential
	if err != nil {
		fmt.Printf("%-9s transport error: %v\n", label, err)
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	text := strings.TrimSpace(string(b))
	if len(text) > 90 {
		text = text[:90] + "..."
	}
	fmt.Printf("%-9s HTTP %d  %s\n", label, resp.StatusCode, strings.ReplaceAll(text, "\n", " "))
}

func main() {
	ctx := context.Background()
	client, _, err := awsx.New(ctx)
	must(err)
	bucket, key := "s3sec-presign", "secret/report.txt"

	_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
	must(err)
	defer func() {
		client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
		client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
	}()
	_, err = client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(bucket), Key: aws.String(key), Body: strings.NewReader("quarterly numbers: private\n")})
	must(err)

	// Anonymous request first: the bucket is private.
	fetch("anon", fmt.Sprintf("%s/%s/%s", os.Getenv("AWS_ENDPOINT_URL"), bucket, key))

	ps := s3.NewPresignClient(client)
	req, err := ps.PresignGetObject(ctx,
		&s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)},
		s3.WithPresignExpires(2*time.Second))
	must(err)
	fmt.Println("method:", req.Method)
	u := req.URL
	if i := strings.Index(u, "?"); i > 0 {
		fmt.Println("url base:", u[:i])
		for _, p := range strings.Split(u[i+1:], "&") {
			if strings.HasPrefix(p, "X-Amz-Signature") {
				p = p[:len("X-Amz-Signature=")+12] + "..."
			}
			fmt.Println("  param:", p)
		}
	}

	// The signature covers the canonical request (method, path, query, host).
	// Sign a different key and compare: a signature cannot be moved to another URL.
	other, err := ps.PresignGetObject(ctx,
		&s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String("secret/other.txt")},
		s3.WithPresignExpires(2*time.Second))
	must(err)
	sig := func(u string) string { return u[strings.Index(u, "X-Amz-Signature=")+16:][:12] }
	fmt.Printf("signature for report.txt: %s...\nsignature for other.txt:  %s...\n", sig(u), sig(other.URL))

	fetch("valid", u)
	// Tamper: point the same signature at a different object.
	fetch("tampered", strings.Replace(u, "report.txt", "other.txt", 1))
	time.Sleep(3 * time.Second)
	fetch("expired", u)
}
