// replay plays the attacker who has a valid signature for one image and
// wants it to vouch for another: it copies the signature artifact from
// the good image's signature tag to the other image's signature tag.
package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"supply/verify"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

func main() {
	repo, goodDigest, _ := strings.Cut(os.Args[1], "@")
	_, evilDigest, _ := strings.Cut(os.Args[2], "@")
	src, _ := name.ParseReference(repo + ":" + verify.SignatureTag(goodDigest))
	dst, _ := name.ParseReference(repo + ":" + verify.SignatureTag(evilDigest))
	img, err := remote.Image(src)
	if err != nil {
		log.Fatal(err)
	}
	if err := remote.Write(dst, img); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("copied the signature of %s onto %s\n", goodDigest[:19], evilDigest[:19])
}
