package main

import (
	"encoding/json"
	"fmt"

	"supply/verify"

	"crypto/ecdsa"
)

// showSBOM verifies the attached attestation and summarises the CycloneDX
// SBOM inside it.
func showSBOM(repo, digest string, pub *ecdsa.PublicKey) error {
	sts, err := verify.Attestation(repo, digest, pub)
	if err != nil {
		return err
	}
	for _, st := range sts {
		var bom struct {
			Components []struct{ Name, Version string } `json:"components"`
		}
		json.Unmarshal(st.Predicate, &bom)
		fmt.Printf("ATTESTED: %s, about %s, %d components:\n", st.PredicateType, digest[:19], len(bom.Components))
		for _, c := range bom.Components {
			fmt.Printf("  %s@%s\n", c.Name, c.Version)
		}
	}
	return nil
}
