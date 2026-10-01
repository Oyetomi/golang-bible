// rolectl: create or delete a bare role so the chain demo has something to assume.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"awsiam/internal/lab"
	"awsiam/internal/policy"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/iam"
)

func main() {
	ctx := context.Background()
	cfg, err := lab.Load(ctx)
	if err != nil {
		log.Fatal(err)
	}
	c := iam.NewFromConfig(cfg)
	cmd, name := os.Args[1], os.Args[2]
	switch cmd {
	case "create":
		_, err = c.CreateRole(ctx, &iam.CreateRoleInput{
			RoleName:                 aws.String(name),
			AssumeRolePolicyDocument: aws.String(policy.Trust("arn:aws:iam::000000000000:root", "").JSON()),
		})
	case "delete":
		_, err = c.DeleteRole(ctx, &iam.DeleteRoleInput{RoleName: aws.String(name)})
	}
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(cmd, "role", name)
}
