// Package lab holds the few helpers every program in this chapter shares.
package lab

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
)

// Prefix marks every resource this chapter creates, so a shared LocalStack
// (or a shared AWS sandbox account) can be swept by prefix.
const Prefix = "iamsec-"

// Load resolves configuration exactly the way production code does: the
// default credential chain, the default region chain, and the standard
// AWS_ENDPOINT_URL override. There is no "if local" branch in the code.
func Load(ctx context.Context, opts ...func(*config.LoadOptions) error) (aws.Config, error) {
	return config.LoadDefaultConfig(ctx, opts...)
}

// Name returns a unique, DNS-safe resource name: iamsec-<label>-<8 hex>.
func Name(label string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	// Bucket names allow only a-z, 0-9, "-" and ".". t.Name() produces
	// "/", ",", " " and capitals, so map everything else to "-".
	label = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r + 'a' - 'A'
		}
		return '-'
	}, label)
	if len(label) > 30 {
		label = label[:30]
	}
	return fmt.Sprintf("%s%s-%s", Prefix, label, hex.EncodeToString(b))
}
