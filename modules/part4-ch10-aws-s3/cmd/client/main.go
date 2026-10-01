// Which credentials did the chain pick, and where do requests go?
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"awss3/awsx"
)

func main() {
	ctx := context.Background()
	client, cfg, err := awsx.New(ctx)
	if err != nil {
		fmt.Println("load config:", err)
		os.Exit(1)
	}
	fmt.Println("region:          ", cfg.Region)
	if cfg.BaseEndpoint != nil {
		fmt.Println("base endpoint:   ", *cfg.BaseEndpoint)
	} else {
		fmt.Println("base endpoint:    (none, real AWS)")
	}

	creds, err := cfg.Credentials.Retrieve(ctx)
	if err != nil {
		fmt.Println("credentials:      NONE FOUND ->", err)
		os.Exit(1)
	}
	fmt.Println("credential source:", creds.Source)
	fmt.Println("access key id:    ", creds.AccessKeyID)

	out, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		fmt.Println("ListBuckets:", err)
		os.Exit(1)
	}
	n := 0
	for _, b := range out.Buckets {
		if len(aws.ToString(b.Name)) >= 6 && aws.ToString(b.Name)[:6] == "s3sec-" {
			n++
		}
	}
	fmt.Println("ListBuckets ok, s3sec- buckets:", n)
}
