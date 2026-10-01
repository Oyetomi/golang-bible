// Create a bucket, upload, head, download, list, delete.
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

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

func main() {
	ctx := context.Background()
	client, _, err := awsx.New(ctx)
	must(err)
	bucket := "s3sec-objects"

	_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
	must(err)
	fmt.Println("created bucket", bucket)

	body := "hello from the Go Bible\n"
	put, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String("notes/hello.txt"),
		Body:        strings.NewReader(body),
		ContentType: aws.String("text/plain"),
		Metadata:    map[string]string{"author": "abbey"},
	})
	must(err)
	fmt.Printf("PutObject   etag=%s bytes=%d\n", aws.ToString(put.ETag), len(body))

	head, err := client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(bucket), Key: aws.String("notes/hello.txt")})
	must(err)
	fmt.Printf("HeadObject  size=%d type=%s metadata=%v\n", aws.ToInt64(head.ContentLength), aws.ToString(head.ContentType), head.Metadata)

	get, err := client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String("notes/hello.txt")})
	must(err)
	defer get.Body.Close() // the body is a live network stream; close it
	data, err := io.ReadAll(get.Body)
	must(err)
	fmt.Printf("GetObject   %q\n", string(data))

	list, err := client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: aws.String(bucket), Prefix: aws.String("notes/")})
	must(err)
	for _, o := range list.Contents {
		fmt.Printf("ListObjectsV2 key=%s size=%d\n", aws.ToString(o.Key), aws.ToInt64(o.Size))
	}

	_, err = client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String("notes/hello.txt")})
	must(err)
	_, err = client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
	must(err)
	fmt.Println("deleted object and bucket")
}
