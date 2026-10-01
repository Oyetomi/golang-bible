package policy

import (
	"strings"
	"testing"
)

func TestLint(t *testing.T) {
	cases := []struct {
		name string
		doc  string
		want []string // rule names, sorted by statement order
	}{
		{"action star", `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"arn:aws:s3:::b/*","Condition":{"Bool":{"aws:SecureTransport":"true"}}}]}`, []string{"action-star"}},
		{"resource star", `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:GetObject","Resource":"*"}]}`, []string{"resource-star"}},
		{"read-only needs no condition", `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::b/*"}]}`, nil},
		{"write without condition", `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:PutObject","Resource":"arn:aws:s3:::b/*"}]}`, []string{"no-condition"}},
		{"deny is never flagged", `{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*"}]}`, nil},
		{"old version", `{"Version":"2008-10-17","Statement":[]}`, []string{"version"}},
		{"trust policy open to anyone", `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"*"},"Action":"sts:AssumeRole"}]}`, []string{"principal-star"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d, err := Parse(tc.doc)
			if err != nil {
				t.Fatal(err)
			}
			var got []string
			for _, f := range Lint(d) {
				got = append(got, f.Rule)
			}
			if strings.Join(got, ",") != strings.Join(tc.want, ",") {
				t.Errorf("rules = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestUploadsOnlyIsClean(t *testing.T) {
	if fs := Lint(UploadsOnly("some-bucket")); len(fs) != 0 {
		t.Fatalf("the chapter's own least-privilege policy has findings: %v", fs)
	}
}
