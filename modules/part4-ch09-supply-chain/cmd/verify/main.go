// verify checks an image's cosign signature against a public key.
//
//	go run ./cmd/verify -key cosign.pub localhost:5001/ledger-api@sha256:...
package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"supply/verify"
)

func main() {
	keyFile := flag.String("key", "cosign.pub", "public key")
	sbom := flag.Bool("sbom", false, "also verify and print the SBOM attestation")
	flag.Parse()
	repo, digest, ok := strings.Cut(flag.Arg(0), "@")
	if !ok {
		fmt.Fprintln(os.Stderr, "give an image as repo@sha256:digest: a tag is not something you can verify")
		os.Exit(2)
	}
	pemBytes, err := os.ReadFile(*keyFile)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	pub, err := verify.ParsePublicKey(pemBytes)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := verify.Image(repo, digest, pub); err != nil {
		fmt.Println("REJECT:", err)
		os.Exit(1)
	}
	fmt.Println("VERIFIED: signed by the holder of", *keyFile)
	if *sbom {
		if err := showSBOM(repo, digest, pub); err != nil {
			fmt.Println("REJECT:", err)
			os.Exit(1)
		}
	}
}
