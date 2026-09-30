// Package verify checks that a container image was signed with cosign by
// the holder of a given ECDSA public key. It uses only the registry API and
// the standard library, so every step of the check is visible.
package verify

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

// signatureAnnotation is where cosign stores the base64 signature on the
// signature layer's descriptor.
const signatureAnnotation = "dev.cosignproject.cosign/signature"

// payload is the "simple signing" document that cosign signs. The only
// field that matters to us is the digest it vouches for.
type payload struct {
	Critical struct {
		Image struct {
			DockerManifestDigest string `json:"docker-manifest-digest"`
		} `json:"image"`
	} `json:"critical"`
}

// ParsePublicKey reads the PEM public key cosign generate-key-pair wrote.
func ParsePublicKey(pemBytes []byte) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("no PEM block in public key")
	}
	k, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	pub, ok := k.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("not an ECDSA public key")
	}
	return pub, nil
}

// SignatureTag is where cosign stores the signatures of an image: a tag
// in the same repository, built from the image's digest.
func SignatureTag(digest string) string {
	return strings.Replace(digest, ":", "-", 1) + ".sig"
}

// Image reports nil only if the image at repo@digest has at least one
// signature that verifies under pub AND that names exactly this digest.
func Image(repo, digest string, pub *ecdsa.PublicKey) error {
	sigRef, err := name.ParseReference(repo+":"+SignatureTag(digest), name.Insecure)
	if err != nil {
		return err
	}
	img, err := remote.Image(sigRef)
	if err != nil {
		return fmt.Errorf("no signature found: %w", err)
	}
	manifest, err := img.Manifest()
	if err != nil {
		return err
	}
	layers, err := img.Layers()
	if err != nil {
		return err
	}
	for i, desc := range manifest.Layers {
		sigB64, ok := desc.Annotations[signatureAnnotation]
		if !ok {
			continue
		}
		sig, err := base64.StdEncoding.DecodeString(sigB64)
		if err != nil {
			continue
		}
		rc, err := layers[i].Uncompressed()
		if err != nil {
			return err
		}
		body, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return err
		}
		sum := sha256.Sum256(body)
		if !ecdsa.VerifyASN1(pub, sum[:], sig) {
			continue // not signed by this key
		}
		var p payload
		if err := json.Unmarshal(body, &p); err != nil {
			continue
		}
		if p.Critical.Image.DockerManifestDigest != digest {
			return fmt.Errorf("signature is valid but vouches for %s, not %s", p.Critical.Image.DockerManifestDigest, digest)
		}
		return nil
	}
	return errors.New("no signature verifies under this key")
}
