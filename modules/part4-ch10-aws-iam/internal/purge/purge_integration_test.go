package purge_test

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"sync"
	"testing"

	"awsiam/internal/lab/labtest"
	"awsiam/internal/purge"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// seed puts keys concurrently (1,005 sequential PUTs is needlessly slow).
func seed(t *testing.T, c *s3.Client, bucket string, keys []string) {
	t.Helper()
	var wg sync.WaitGroup
	sem := make(chan struct{}, 16)
	errs := make(chan error, len(keys))
	for _, k := range keys {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			_, err := c.PutObject(context.Background(), &s3.PutObjectInput{Bucket: aws.String(bucket), Key: aws.String(k), Body: bytes.NewReader([]byte("x"))})
			if err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("seed: %v", err)
	}
}

func remaining(t *testing.T, c *s3.Client, bucket string) []string {
	t.Helper()
	var out []string
	p := s3.NewListObjectsV2Paginator(c, &s3.ListObjectsV2Input{Bucket: aws.String(bucket)})
	for p.HasMorePages() {
		pg, err := p.NextPage(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		for _, o := range pg.Contents {
			out = append(out, aws.ToString(o.Key))
		}
	}
	sort.Strings(out)
	return out
}

func numbered(prefix string, n int) []string {
	ks := make([]string, n)
	for i := range ks {
		ks[i] = fmt.Sprintf("%s%04d.csv", prefix, i)
	}
	return ks
}

func TestPrefix_LocalStack(t *testing.T) {
	cases := []struct {
		name        string
		keys        []string
		prefix      string
		wantDeleted int
		wantLeft    []string
	}{
		{"empty prefix, nothing to do", nil, "reports/", 0, nil},
		{"three keys", []string{"reports/a", "reports/b", "reports/c"}, "reports/", 3, nil},
		{"leaves siblings alone", []string{"reports/a", "reports-archive/a", "other/a"}, "reports/", 1, []string{"other/a", "reports-archive/a"}},
		{"1,005 keys: more than one page", numbered("reports/", 1005), "reports/", 1005, nil},
	}
	c := labtest.S3(t)
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			bucket := labtest.Bucket(t, c)
			seed(t, c, bucket, tc.keys)
			got, err := purge.Prefix(context.Background(), c, bucket, tc.prefix)
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.wantDeleted {
				t.Errorf("deleted = %d, want %d", got, tc.wantDeleted)
			}
			left := remaining(t, c, bucket)
			if len(left) != len(tc.wantLeft) {
				t.Fatalf("%d objects left in bucket, want %d (first: %v)", len(left), len(tc.wantLeft), head(left))
			}
			for i := range left {
				if left[i] != tc.wantLeft[i] {
					t.Errorf("left[%d] = %q, want %q", i, left[i], tc.wantLeft[i])
				}
			}
		})
	}
}

func head(s []string) []string {
	if len(s) > 3 {
		return s[:3]
	}
	return s
}
