// Deletes every s3sec- bucket (objects, versions of in-flight multipart uploads) the chapter left behind.
package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"awss3/awsx"
)

func main() {
	ctx := context.Background()
	c, _, err := awsx.New(ctx)
	if err != nil {
		panic(err)
	}
	bs, err := c.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		panic(err)
	}
	for _, b := range bs.Buckets {
		name := aws.ToString(b.Name)
		if !strings.HasPrefix(name, "s3sec-") {
			continue
		}
		objs, _ := c.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: b.Name})
		for _, o := range objs.Contents {
			c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: b.Name, Key: o.Key})
		}
		ups, _ := c.ListMultipartUploads(ctx, &s3.ListMultipartUploadsInput{Bucket: b.Name})
		for _, u := range ups.Uploads {
			c.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{Bucket: b.Name, Key: u.Key, UploadId: u.UploadId})
		}
		_, err := c.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: b.Name})
		fmt.Println("cleanup:", name, "err =", err)
	}
}
