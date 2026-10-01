// Multipart upload of a ~25 MB object with the transfer manager, at two
// concurrency settings, verified by sha256 after the round trip.
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"awss3/awsx"
)

const size = 25*1024*1024 + 123_457 // deliberately not a multiple of the part size

// must panics so that deferred bucket cleanup still runs (os.Exit would skip it).
func must(err error) {
	if err != nil {
		panic(err)
	}
}

// delayed adds a fixed pause before every HTTP request: a stand-in for the
// round-trip time a real region would add. It is labelled in the output.
type delayed struct {
	d    time.Duration
	next http.RoundTripper
}

func (t delayed) RoundTrip(r *http.Request) (*http.Response, error) {
	time.Sleep(t.d)
	return t.next.RoundTrip(r)
}

func sum(path string) string {
	f, err := os.Open(path)
	must(err)
	defer f.Close()
	h := sha256.New()
	_, err = io.Copy(h, f)
	must(err)
	return fmt.Sprintf("%x", h.Sum(nil))
}

func main() {
	rtt := flag.Duration("rtt", 0, "injected delay per HTTP request (0 = none)")
	flag.Parse()
	ctx := context.Background()

	var opts []func(*config.LoadOptions) error
	if *rtt > 0 {
		opts = append(opts, config.WithHTTPClient(&http.Client{Transport: delayed{*rtt, http.DefaultTransport}}))
	}
	client, _, err := awsx.New(ctx, opts...)
	must(err)

	bucket := "s3sec-multipart"
	_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
	must(err)
	var keys []string
	defer func() {
		for _, k := range keys {
			client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(k)})
		}
		client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucket)})
	}()

	// A random file and its sha256, computed without the SDK.
	f, err := os.CreateTemp("", "s3sec-*.bin")
	must(err)
	defer os.Remove(f.Name())
	_, err = io.CopyN(f, rand.Reader, size)
	must(err)
	f.Close()
	want := sum(f.Name())
	fmt.Printf("injected delay per request: %v\n", *rtt)
	fmt.Printf("local file: %d bytes, sha256=%s...\n", size, want[:16])

	const partSize = 5 << 20
	for _, conc := range []int{1, 8} {
		tm := transfermanager.New(client, func(o *transfermanager.Options) {
			o.PartSizeBytes = partSize
			o.Concurrency = conc
		})
		var ups, dls []time.Duration
		var parts int
		var etag string
		for run := 0; run < 5; run++ {
			key := fmt.Sprintf("big-c%d-r%d.bin", conc, run)
			keys = append(keys, key)
			src, err := os.Open(f.Name())
			must(err)
			t0 := time.Now()
			out, err := tm.UploadObject(ctx, &transfermanager.UploadObjectInput{
				Bucket: aws.String(bucket), Key: aws.String(key), Body: src})
			must(err)
			ups = append(ups, time.Since(t0))
			src.Close()
			parts, etag = len(out.CompletedParts), aws.ToString(out.ETag)

			dst, err := os.CreateTemp("", "s3sec-dl-*.bin")
			must(err)
			t0 = time.Now()
			_, err = tm.DownloadObject(ctx, &transfermanager.DownloadObjectInput{
				Bucket: aws.String(bucket), Key: aws.String(key), WriterAt: dst})
			must(err)
			dls = append(dls, time.Since(t0))
			dst.Close()
			if got := sum(dst.Name()); got != want {
				fmt.Println("CHECKSUM MISMATCH", key)
				os.Exit(1)
			}
			os.Remove(dst.Name())
		}
		fmt.Printf("\nconcurrency=%d part=%dMiB  parts uploaded=%d  etag=%s\n", conc, partSize>>20, parts, etag)
		fmt.Printf("  upload   median of 5: %v   (all: %v)\n", med(ups), round(ups))
		fmt.Printf("  download median of 5: %v   (all: %v)\n", med(dls), round(dls))
		fmt.Printf("  sha256 of all 5 downloads == local file: true\n")
	}
}

func round(d []time.Duration) []time.Duration {
	o := make([]time.Duration, len(d))
	for i, v := range d {
		o[i] = v.Round(time.Millisecond)
	}
	return o
}

func med(d []time.Duration) time.Duration {
	c := append([]time.Duration(nil), d...)
	sort.Slice(c, func(i, j int) bool { return c[i] < c[j] })
	return c[len(c)/2].Round(time.Millisecond)
}
