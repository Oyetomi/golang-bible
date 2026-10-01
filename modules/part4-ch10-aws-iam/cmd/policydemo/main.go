// policydemo: policy as code. Build -> lint -> create -> attach -> round-trip,
// then probe what the local endpoint actually enforces.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"

	"awsiam/internal/lab"
	"awsiam/internal/policy"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/iam"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

const badPolicy = `{
  "Version": "2008-10-17",
  "Statement": [
    {"Sid": "Everything", "Effect": "Allow", "Action": "*", "Resource": "*"},
    {"Effect": "Allow", "Action": ["s3:*"], "Resource": "arn:aws:s3:::prod-data/*"},
    {"Sid": "Writers", "Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::prod-data/*"}
  ]
}`

func report(name string, d policy.Document) {
	fs := policy.Lint(d)
	fmt.Printf("--- lint %s: %d finding(s)\n", name, len(fs))
	for _, f := range fs {
		fmt.Println(f)
	}
}

func main() {
	ctx := context.Background()
	cfg, err := lab.Load(ctx)
	if err != nil {
		log.Fatal(err)
	}
	iamc, s3root := iam.NewFromConfig(cfg), s3.NewFromConfig(cfg)
	id, err := sts.NewFromConfig(cfg).GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		log.Fatal(err)
	}

	// ---- 1. lint a good and a bad policy
	allowed, forbidden := lab.Name("allowed"), lab.Name("forbidden")
	good := policy.UploadsOnly(allowed)
	fmt.Println("good policy:\n" + good.JSON())
	report("good", good)
	bad, err := policy.Parse(badPolicy)
	if err != nil {
		log.Fatal(err)
	}
	report("bad", bad)

	// ---- 2. create policy + role, attach, read back
	polName, roleName := lab.Name("uploads-policy"), lab.Name("uploads-role")
	pol, err := iamc.CreatePolicy(ctx, &iam.CreatePolicyInput{PolicyName: aws.String(polName), PolicyDocument: aws.String(good.JSON())})
	if err != nil {
		log.Fatal(err)
	}
	role, err := iamc.CreateRole(ctx, &iam.CreateRoleInput{
		RoleName:                 aws.String(roleName),
		AssumeRolePolicyDocument: aws.String(policy.Trust("arn:aws:iam::"+aws.ToString(id.Account)+":root", "").JSON()),
	})
	if err != nil {
		log.Fatal(err)
	}
	defer func() { // cleanup in dependency order
		iamc.DetachRolePolicy(ctx, &iam.DetachRolePolicyInput{RoleName: aws.String(roleName), PolicyArn: pol.Policy.Arn})
		iamc.DeleteRole(ctx, &iam.DeleteRoleInput{RoleName: aws.String(roleName)})
		iamc.DeletePolicy(ctx, &iam.DeletePolicyInput{PolicyArn: pol.Policy.Arn})
		for _, b := range []string{allowed, forbidden} {
			emptyAndDelete(ctx, s3root, b)
		}
	}()
	if _, err := iamc.AttachRolePolicy(ctx, &iam.AttachRolePolicyInput{RoleName: aws.String(roleName), PolicyArn: pol.Policy.Arn}); err != nil {
		log.Fatal(err)
	}
	att, err := iamc.ListAttachedRolePolicies(ctx, &iam.ListAttachedRolePoliciesInput{RoleName: aws.String(roleName)})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("attached to %s: ", roleName)
	for _, a := range att.AttachedPolicies {
		fmt.Println(aws.ToString(a.PolicyName), aws.ToString(a.PolicyArn))
	}
	ver, err := iamc.GetPolicyVersion(ctx, &iam.GetPolicyVersionInput{PolicyArn: pol.Policy.Arn, VersionId: pol.Policy.DefaultVersionId})
	if err != nil {
		log.Fatal(err)
	}
	// Real IAM returns the document URL-encoded (RFC 3986) and the SDK does
	// NOT decode it for you; this endpoint returns it plain. Handle both.
	doc := aws.ToString(ver.PolicyVersion.Document)
	fmt.Println("document comes back URL-encoded:", strings.HasPrefix(doc, "%7B"))
	if strings.HasPrefix(doc, "%7B") {
		if doc, err = url.QueryUnescape(doc); err != nil {
			log.Fatal(err)
		}
	}
	var a, b bytes.Buffer
	json.Compact(&a, []byte(doc))
	json.Compact(&b, []byte(good.JSON()))
	fmt.Println("round-trip identical to what we built:", a.String() == b.String())
	back, err := policy.Parse(doc)
	if err != nil {
		log.Fatal(err)
	}
	report("read-back from IAM", back)

	// ---- 3. what is enforced? Assume the role and try things its policy forbids.
	for _, bk := range []string{allowed, forbidden} {
		if _, err := s3root.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bk)}); err != nil {
			log.Fatal(err)
		}
	}
	as, err := sts.NewFromConfig(cfg).AssumeRole(ctx, &sts.AssumeRoleInput{RoleArn: role.Role.Arn, RoleSessionName: aws.String("probe")})
	if err != nil {
		log.Fatal(err)
	}
	cc := as.Credentials
	cfg2 := cfg.Copy()
	cfg2.Credentials = credentials.NewStaticCredentialsProvider(aws.ToString(cc.AccessKeyId), aws.ToString(cc.SecretAccessKey), aws.ToString(cc.SessionToken))
	s3r := s3.NewFromConfig(cfg2)

	type probe struct {
		name string
		real string // what real AWS does, derived from the policy above
		run  func() error
	}
	body := func() *bytes.Reader { return bytes.NewReader([]byte("x")) }
	probes := []probe{
		{"put allowed/uploads/a.txt WITH sse=AES256", "ALLOW", func() error {
			_, err := s3r.PutObject(ctx, &s3.PutObjectInput{Bucket: &allowed, Key: aws.String("uploads/a.txt"), Body: body(), ServerSideEncryption: s3types.ServerSideEncryptionAes256})
			return err
		}},
		{"put allowed/uploads/b.txt WITHOUT sse", "DENY", func() error {
			_, err := s3r.PutObject(ctx, &s3.PutObjectInput{Bucket: &allowed, Key: aws.String("uploads/b.txt"), Body: body()})
			return err
		}},
		{"put allowed/other/c.txt (wrong prefix)", "DENY", func() error {
			_, err := s3r.PutObject(ctx, &s3.PutObjectInput{Bucket: &allowed, Key: aws.String("other/c.txt"), Body: body(), ServerSideEncryption: s3types.ServerSideEncryptionAes256})
			return err
		}},
		{"put forbidden/uploads/d.txt (other bucket)", "DENY", func() error {
			_, err := s3r.PutObject(ctx, &s3.PutObjectInput{Bucket: &forbidden, Key: aws.String("uploads/d.txt"), Body: body(), ServerSideEncryption: s3types.ServerSideEncryptionAes256})
			return err
		}},
		{"delete allowed/uploads/a.txt (no s3:DeleteObject)", "DENY", func() error {
			_, err := s3r.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &allowed, Key: aws.String("uploads/a.txt")})
			return err
		}},
		{"list all buckets (no s3:ListAllMyBuckets)", "DENY", func() error {
			_, err := s3r.ListBuckets(ctx, &s3.ListBucketsInput{})
			return err
		}},
	}
	fmt.Printf("--- enforcement probe as %s\n", aws.ToString(as.AssumedRoleUser.Arn))
	fmt.Printf("%-52s %-10s %s\n", "request", "real AWS", "this endpoint")
	for _, p := range probes {
		got := "ALLOWED"
		if err := p.run(); err != nil {
			var ae interface{ ErrorCode() string }
			got = "denied"
			if errors.As(err, &ae) {
				got += " (" + ae.ErrorCode() + ")"
			}
		}
		fmt.Printf("%-52s %-10s %s\n", p.name, p.real, got)
	}

	// SimulatePrincipalPolicy is the API that WOULD evaluate policies offline.
	_, err = iamc.SimulatePrincipalPolicy(ctx, &iam.SimulatePrincipalPolicyInput{
		PolicySourceArn: role.Role.Arn, ActionNames: []string{"s3:DeleteObject"},
	})
	if err != nil {
		msg := err.Error()
		if i := strings.Index(msg, "<?xml"); i >= 0 {
			msg = msg[:i] + "<xml error body: NoSuchEntity, \"Policy ... not found\">"
		}
		fmt.Println("SimulatePrincipalPolicy:", msg)
	} else {
		fmt.Println("SimulatePrincipalPolicy: call succeeded")
	}
}

func emptyAndDelete(ctx context.Context, c *s3.Client, bucket string) {
	p := s3.NewListObjectsV2Paginator(c, &s3.ListObjectsV2Input{Bucket: &bucket})
	for p.HasMorePages() {
		pg, err := p.NextPage(ctx)
		if err != nil {
			return
		}
		for _, o := range pg.Contents {
			c.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &bucket, Key: o.Key})
		}
	}
	c.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: &bucket})
}
