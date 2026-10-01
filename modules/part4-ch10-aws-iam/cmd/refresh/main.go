// refresh: stscreds.AssumeRoleProvider + CredentialsCache renewing credentials.
package main

import (
	"context"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"awsiam/internal/lab"
	"awsiam/internal/policy"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/iam"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// countingSTS wraps the STS client so we can SEE every AssumeRole call the
// provider makes. stscreds only needs this one-method interface.
type countingSTS struct {
	inner *sts.Client
	calls atomic.Int32
}

func (c *countingSTS) AssumeRole(ctx context.Context, in *sts.AssumeRoleInput, o ...func(*sts.Options)) (*sts.AssumeRoleOutput, error) {
	c.calls.Add(1)
	return c.inner.AssumeRole(ctx, in, o...)
}

func main() {
	ctx := context.Background()
	cfg, err := lab.Load(ctx)
	if err != nil {
		log.Fatal(err)
	}
	iamc := iam.NewFromConfig(cfg)
	id, err := sts.NewFromConfig(cfg).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		log.Fatal(err)
	}
	roleName := lab.Name("refresh-role")
	role, err := iamc.CreateRole(ctx, &iam.CreateRoleInput{
		RoleName:                 aws.String(roleName),
		AssumeRolePolicyDocument: aws.String(policy.Trust("arn:aws:iam::"+aws.ToString(id.Account)+":root", "").JSON()),
	})
	if err != nil {
		log.Fatal(err)
	}
	defer iamc.DeleteRole(ctx, &iam.DeleteRoleInput{RoleName: aws.String(roleName)})

	counter := &countingSTS{inner: sts.NewFromConfig(cfg)}
	provider := stscreds.NewAssumeRoleProvider(counter, aws.ToString(role.Role.Arn), func(o *stscreds.AssumeRoleOptions) {
		o.RoleSessionName = "refresh-demo"
		o.Duration = 5 * time.Second // real AWS refuses < 900s; see NOTES
	})
	// CredentialsCache is what makes it "automatic": it calls the provider
	// again only when the cached credentials are within ExpiryWindow of expiring.
	creds := aws.NewCredentialsCache(provider, func(o *aws.CredentialsCacheOptions) {
		o.ExpiryWindow = 2 * time.Second
	})

	start := time.Now()
	last := ""
	for i := 0; i < 14; i++ {
		c, err := creds.Retrieve(ctx)
		if err != nil {
			log.Fatal(err)
		}
		state := "cached"
		if c.AccessKeyID != last {
			state = "RENEWED"
			last = c.AccessKeyID
		}
		fmt.Printf("t=%4.1fs  key=%s  expires in %4.1fs  sts_calls=%d  %s\n",
			time.Since(start).Seconds(), c.AccessKeyID, time.Until(c.Expires).Seconds(), counter.calls.Load(), state)
		time.Sleep(time.Second)
	}
}
