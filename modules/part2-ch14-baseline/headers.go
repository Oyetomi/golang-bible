package baseline

import (
	"crypto/tls"
	"net/http"
)

// Secure adds the headers every response should carry.
func Secure(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// TLSConfig is the server side of "enforce TLS": nothing older than TLS 1.2.
func TLSConfig() *tls.Config {
	return &tls.Config{MinVersion: tls.VersionTLS12}
}
