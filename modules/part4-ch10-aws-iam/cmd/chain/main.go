// chain: report which link of the default credential chain supplied the keys.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"awsiam/internal/lab"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	cfg, err := lab.Load(ctx)
	if err != nil {
		fmt.Println("load error:", err)
		os.Exit(1)
	}
	c, err := cfg.Credentials.Retrieve(ctx)
	if err != nil {
		fmt.Println("retrieve error:", err)
		os.Exit(1)
	}
	id, err := sts.NewFromConfig(cfg).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		fmt.Println("sts error:", err)
		os.Exit(1)
	}
	fmt.Printf("source=%-28s keyid=%-22s session_token=%-5t region=%s\n  caller=%s\n",
		c.Source, c.AccessKeyID, c.SessionToken != "", cfg.Region, aws.ToString(id.Arn))
}
