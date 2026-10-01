// whoami: who am I, then who am I after assuming a role with a session policy.
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"awsiam/internal/lab"
	"awsiam/internal/policy"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/iam"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

func main() {
	ctx := context.Background()
	cfg, err := lab.Load(ctx)
	if err != nil {
		log.Fatal(err)
	}
	stsc := sts.NewFromConfig(cfg)
	iamc := iam.NewFromConfig(cfg)

	// 1. Who am I? GetCallerIdentity needs no permission at all.
	id, err := stsc.GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("base identity:    account=%s arn=%s\n", aws.ToString(id.Account), aws.ToString(id.Arn))

	// 2. Create a role. The trust policy says who may assume it.
	roleName := lab.Name("whoami-role")
	trust := policy.Trust("arn:aws:iam::"+aws.ToString(id.Account)+":root", "chapter-external-id")
	fmt.Println("trust policy:\n" + trust.JSON())
	role, err := iamc.CreateRole(ctx, &iam.CreateRoleInput{
		RoleName:                 aws.String(roleName),
		AssumeRolePolicyDocument: aws.String(trust.JSON()),
		MaxSessionDuration:       aws.Int32(3600),
	})
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if _, err := iamc.DeleteRole(ctx, &iam.DeleteRoleInput{RoleName: aws.String(roleName)}); err != nil {
			log.Printf("cleanup: %v", err)
		}
	}()
	fmt.Println("created role:    ", aws.ToString(role.Role.Arn))

	// 3. Assume it, narrowing further with a session policy. The effective
	// permissions are the INTERSECTION of the role's policies and this one.
	session := policy.New(policy.Statement{
		Effect: "Allow", Action: policy.StringList{"s3:GetObject"},
		Resource: policy.StringList{"arn:aws:s3:::iamsec-demo/uploads/*"},
	})
	out, err := stsc.AssumeRole(ctx, &sts.AssumeRoleInput{
		RoleArn:         role.Role.Arn,
		RoleSessionName: aws.String("chapter-session"),
		ExternalId:      aws.String("chapter-external-id"),
		DurationSeconds: aws.Int32(900),
		Policy:          aws.String(session.JSON()),
	})
	if err != nil {
		log.Fatal(err)
	}
	c := out.Credentials
	fmt.Printf("assumed:          user=%s\n", aws.ToString(out.AssumedRoleUser.Arn))
	fmt.Printf("temp credentials: keyid=%s... token=%d bytes expires in %s\n",
		aws.ToString(c.AccessKeyId)[:8], len(aws.ToString(c.SessionToken)), time.Until(aws.ToTime(c.Expiration)).Round(time.Minute))

	// 4. Who am I now? Sign STS calls with the temporary credentials.
	cfg2 := cfg.Copy()
	cfg2.Credentials = aws.NewCredentialsCache(stscreds.NewAssumeRoleProvider(stsc, aws.ToString(role.Role.Arn), func(o *stscreds.AssumeRoleOptions) {
		o.RoleSessionName = "chapter-session-2"
		o.ExternalID = aws.String("chapter-external-id")
	}))
	id2, err := sts.NewFromConfig(cfg2).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("assumed identity: account=%s arn=%s\n", aws.ToString(id2.Account), aws.ToString(id2.Arn))

	// 5. Wrong ExternalId: the trust policy refuses. Does LocalStack?
	_, err = stsc.AssumeRole(ctx, &sts.AssumeRoleInput{
		RoleArn: role.Role.Arn, RoleSessionName: aws.String("wrong-extid"), ExternalId: aws.String("not-the-id"),
	})
	fmt.Printf("wrong ExternalId: err=%v\n", err)
}
