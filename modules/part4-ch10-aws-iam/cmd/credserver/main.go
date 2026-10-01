// credserver: a 20-line stand-in for the ECS / EKS Pod Identity credentials
// endpoint, so the chain demo can exercise the container-credentials source.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	addr := os.Args[1] // e.g. 127.0.0.1:18080
	http.HandleFunc("/creds", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "chapter-token" {
			http.Error(w, "bad token", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"AccessKeyId":     "test",
			"SecretAccessKey": "test",
			"Token":           "",
			"Expiration":      time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		})
	})
	fmt.Println("credserver on", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
