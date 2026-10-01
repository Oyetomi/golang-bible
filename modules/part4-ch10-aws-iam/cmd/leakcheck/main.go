// leakcheck: list any iamsec- resources left behind.
package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"awsiam/internal/lab"

	"github.com/aws/aws-sdk-go-v2/service/iam"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func main() {
	ctx := context.Background()
	cfg, err := lab.Load(ctx)
	if err != nil {
		log.Fatal(err)
	}
	n := 0
	b, err := s3.NewFromConfig(cfg).ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		log.Fatal(err)
	}
	for _, x := range b.Buckets {
		if strings.HasPrefix(*x.Name, lab.Prefix) {
			fmt.Println("bucket", *x.Name)
			n++
		}
	}
	c := iam.NewFromConfig(cfg)
	r, _ := c.ListRoles(ctx, &iam.ListRolesInput{})
	for _, x := range r.Roles {
		if strings.HasPrefix(*x.RoleName, lab.Prefix) {
			fmt.Println("role", *x.RoleName)
			n++
		}
	}
	p, _ := c.ListPolicies(ctx, &iam.ListPoliciesInput{Scope: "Local"})
	for _, x := range p.Policies {
		if strings.HasPrefix(*x.PolicyName, lab.Prefix) {
			fmt.Println("policy", *x.PolicyName)
			n++
		}
	}
	fmt.Printf("%d leaked iamsec- resources\n", n)
}
