// Package policy builds IAM policy documents from Go structs and lints them.
package policy

import (
	"encoding/json"
	"fmt"
)

// StringList marshals as a JSON array and unmarshals from either a bare
// string or an array, because IAM accepts both spellings.
type StringList []string

func (s *StringList) UnmarshalJSON(b []byte) error {
	var one string
	if err := json.Unmarshal(b, &one); err == nil {
		*s = StringList{one}
		return nil
	}
	var many []string
	if err := json.Unmarshal(b, &many); err != nil {
		return fmt.Errorf("expected string or []string: %w", err)
	}
	*s = many
	return nil
}

// Principal is the trust-policy "who". Keys are AWS, Service, Federated.
type Principal map[string]StringList

// Cond is the Condition block: operator -> key -> values.
type Cond map[string]map[string]StringList

type Statement struct {
	Sid       string     `json:"Sid,omitempty"`
	Effect    string     `json:"Effect"`
	Principal Principal  `json:"Principal,omitempty"`
	Action    StringList `json:"Action,omitempty"`
	Resource  StringList `json:"Resource,omitempty"`
	Condition Cond       `json:"Condition,omitempty"`
}

type Document struct {
	Version   string      `json:"Version"`
	Statement []Statement `json:"Statement"`
}

// Version is the only policy language version you should ever write.
// "2008-10-17" (the old default) silently disables policy variables.
const Version = "2012-10-17"

func New(stmts ...Statement) Document { return Document{Version: Version, Statement: stmts} }

func (d Document) JSON() string {
	b, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		panic(err) // a struct of strings cannot fail to marshal
	}
	return string(b)
}

func Parse(s string) (Document, error) {
	var d Document
	if err := json.Unmarshal([]byte(s), &d); err != nil {
		return d, err
	}
	return d, nil
}

// Trust builds a trust policy letting one AWS principal assume a role,
// optionally pinned by an ExternalId (the confused-deputy guard).
func Trust(principalARN, externalID string) Document {
	st := Statement{
		Sid:       "AllowAssume",
		Effect:    "Allow",
		Principal: Principal{"AWS": {principalARN}},
		Action:    StringList{"sts:AssumeRole"},
	}
	if externalID != "" {
		st.Condition = Cond{"StringEquals": {"sts:ExternalId": {externalID}}}
	}
	return New(st)
}

// UploadsOnly is the least-privilege policy used through the chapter: one
// bucket, one prefix, encrypted writes only, TLS only.
func UploadsOnly(bucket string) Document {
	bucketARN := "arn:aws:s3:::" + bucket
	return New(
		Statement{
			Sid:      "ReadWriteUploadsPrefix",
			Effect:   "Allow",
			Action:   StringList{"s3:GetObject", "s3:PutObject"},
			Resource: StringList{bucketARN + "/uploads/*"},
			Condition: Cond{
				"StringEquals": {"s3:x-amz-server-side-encryption": {"AES256"}},
			},
		},
		Statement{
			Sid:      "ListUploadsPrefix",
			Effect:   "Allow",
			Action:   StringList{"s3:ListBucket"},
			Resource: StringList{bucketARN},
			Condition: Cond{
				"StringLike": {"s3:prefix": {"uploads/*"}},
			},
		},
		Statement{
			Sid:      "DenyPlainHTTP",
			Effect:   "Deny",
			Action:   StringList{"s3:*"},
			Resource: StringList{bucketARN, bucketARN + "/*"},
			Condition: Cond{
				"Bool": {"aws:SecureTransport": {"false"}},
			},
		},
	)
}
