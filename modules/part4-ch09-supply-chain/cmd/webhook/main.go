// webhook is a Kubernetes validating admission webhook that refuses to run
// a container image unless it is pinned by digest and signed by our key.
package main

import (
	"crypto/ecdsa"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"supply/verify"

	admissionv1 "k8s.io/api/admission/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func main() {
	keyFile := flag.String("key", "/etc/policy/cosign.pub", "the public key images must be signed with")
	rewrite := flag.String("registry-rewrite", "", "from=to: verify signatures at a different address than the pod's image names (localhost:5001=registry:5000)")
	flag.Parse()

	pemBytes, err := os.ReadFile(*keyFile)
	if err != nil {
		log.Fatal(err)
	}
	pub, err := verify.ParsePublicKey(pemBytes)
	if err != nil {
		log.Fatal(err)
	}
	from, to, _ := strings.Cut(*rewrite, "=")

	http.HandleFunc("POST /validate", func(w http.ResponseWriter, r *http.Request) {
		var review admissionv1.AdmissionReview
		if err := json.NewDecoder(r.Body).Decode(&review); err != nil || review.Request == nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		start := time.Now()
		allowed, reason := decide(review.Request, pub, from, to)
		log.Printf("%-6s %s/%s: %s (%v)", verdict(allowed), review.Request.Namespace, review.Request.Name, reason, time.Since(start).Round(time.Millisecond))

		resp := &admissionv1.AdmissionResponse{UID: review.Request.UID, Allowed: allowed}
		if !allowed {
			resp.Result = &metav1.Status{Message: reason}
		}
		review.Response, review.Request = resp, nil
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(review)
	})
	log.Println("image-policy webhook on :8443")
	log.Fatal(http.ListenAndServeTLS(":8443", "/etc/tls/tls.crt", "/etc/tls/tls.key", nil))
}

func verdict(ok bool) string {
	if ok {
		return "ALLOW"
	}
	return "DENY"
}

// decide checks every image in the pod. One bad image denies the pod.
func decide(req *admissionv1.AdmissionRequest, pub *ecdsa.PublicKey, from, to string) (bool, string) {
	var pod corev1.Pod
	if err := json.Unmarshal(req.Object.Raw, &pod); err != nil {
		return false, "cannot read the pod: " + err.Error()
	}
	var images []string
	for _, c := range pod.Spec.InitContainers {
		images = append(images, c.Image)
	}
	for _, c := range pod.Spec.Containers {
		images = append(images, c.Image)
	}
	for _, c := range pod.Spec.EphemeralContainers {
		images = append(images, c.Image)
	}
	for _, image := range images {
		repo, digest, pinned := strings.Cut(image, "@")
		if !pinned {
			return false, fmt.Sprintf("%s is not pinned by digest: a tag can be moved to different content", image)
		}
		if from != "" && strings.HasPrefix(repo, from) {
			repo = to + strings.TrimPrefix(repo, from)
		}
		if err := verify.Image(repo, digest, pub); err != nil {
			return false, fmt.Sprintf("%s: %v", image, err)
		}
	}
	return true, fmt.Sprintf("%d image(s) pinned and signed", len(images))
}
