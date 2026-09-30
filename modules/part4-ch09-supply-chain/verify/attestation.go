package verify

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
)

// envelope is a DSSE envelope: a payload, its type, and signatures over
// both. It is what cosign attest stores in the registry.
type envelope struct {
	PayloadType string `json:"payloadType"`
	Payload     string `json:"payload"` // base64
	Signatures  []struct {
		Sig string `json:"sig"` // base64
	} `json:"signatures"`
}

// Statement is the in-toto statement inside the envelope: WHAT is being
// claimed (the predicate), and about WHICH artifact (the subjects).
type Statement struct {
	Type          string `json:"_type"`
	PredicateType string `json:"predicateType"`
	Subject       []struct {
		Name   string            `json:"name"`
		Digest map[string]string `json:"digest"`
	} `json:"subject"`
	Predicate json.RawMessage `json:"predicate"`
}

// pae is DSSE's "pre-authentication encoding": what is actually signed.
// Signing the type together with the payload stops a signature made for
// one kind of document from being replayed as another.
func pae(payloadType string, payload []byte) []byte {
	return []byte(fmt.Sprintf("DSSEv1 %d %s %d %s", len(payloadType), payloadType, len(payload), payload))
}

// Attestation returns the statements attached to repo@digest whose
// signature verifies under pub and whose subject is exactly this digest.
func Attestation(repo, digest string, pub *ecdsa.PublicKey) ([]Statement, error) {
	ref, err := name.ParseReference(repo+":"+strings.Replace(digest, ":", "-", 1)+".att", name.Insecure)
	if err != nil {
		return nil, err
	}
	img, err := remote.Image(ref)
	if err != nil {
		return nil, fmt.Errorf("no attestation found: %w", err)
	}
	layers, err := img.Layers()
	if err != nil {
		return nil, err
	}
	var out []Statement
	for _, l := range layers {
		rc, err := l.Uncompressed()
		if err != nil {
			return nil, err
		}
		raw, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		var env envelope
		if json.Unmarshal(raw, &env) != nil {
			continue
		}
		payload, err := base64.StdEncoding.DecodeString(env.Payload)
		if err != nil {
			continue
		}
		sum := sha256.Sum256(pae(env.PayloadType, payload))
		verified := false
		for _, s := range env.Signatures {
			sig, err := base64.StdEncoding.DecodeString(s.Sig)
			if err == nil && ecdsa.VerifyASN1(pub, sum[:], sig) {
				verified = true
			}
		}
		if !verified {
			continue
		}
		var st Statement
		if json.Unmarshal(payload, &st) != nil {
			continue
		}
		if len(st.Subject) != 1 || "sha256:"+st.Subject[0].Digest["sha256"] != digest {
			return nil, fmt.Errorf("attestation is validly signed but is about a different image")
		}
		out = append(out, st)
	}
	if len(out) == 0 {
		return nil, errors.New("no attestation verifies under this key")
	}
	return out, nil
}
