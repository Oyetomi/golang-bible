package acl

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

type ctxKey struct{}

// Authn stands in for verified-JWT middleware: the bearer token is the user id,
// looked up in the users table. Everything after this line trusts ONLY what it stored.
func (s *Store) Authn(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("Authorization")
		var p Principal
		err := s.Pool.QueryRow(r.Context(),
			`SELECT id, tenant_id, role FROM users WHERE id = $1`, id).Scan(&p.UserID, &p.TenantID, &p.Role)
		if err != nil {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	})
}

func Who(r *http.Request) Principal { p, _ := r.Context().Value(ctxKey{}).(Principal); return p }

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

// Routes registers the leaky v0 and the scoped v1 side by side.
func (s *Store) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /v0/accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
		a, err := s.AccountByID(r.Context(), id)
		if errors.Is(err, ErrNotFound) {
			http.Error(w, "not found", 404)
			return
		}
		writeJSON(w, 200, a)
	})
	mux.HandleFunc("GET /v1/accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
		a, err := s.AccountFor(r.Context(), Who(r), id)
		if errors.Is(err, ErrNotFound) {
			http.Error(w, "not found", 404)
			return
		}
		writeJSON(w, 200, a)
	})
	mux.HandleFunc("GET /v0/accounts", func(w http.ResponseWriter, r *http.Request) {
		as, _ := s.ListAll(r.Context())
		writeJSON(w, 200, as)
	})
	mux.HandleFunc("GET /v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		as, _ := s.ListFor(r.Context(), Who(r))
		writeJSON(w, 200, as)
	})

	// v2: same scoping, but says 403 when the row exists and is not yours (an existence oracle).
	mux.HandleFunc("GET /v2/accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if _, err := s.AccountFor(r.Context(), Who(r), id); err == nil {
			a, _ := s.AccountByID(r.Context(), id)
			writeJSON(w, 200, a)
			return
		}
		if _, err := s.AccountByID(r.Context(), id); err == nil {
			http.Error(w, "forbidden", 403)
			return
		}
		http.Error(w, "not found", 404)
	})

	// v0 trusts the tenant named in the body; v1 uses the tenant bound at login.
	type credit struct {
		TenantID  string `json:"tenant_id"`
		AccountID int64  `json:"account_id"`
		Amount    int64  `json:"amount"`
	}
	mux.HandleFunc("POST /v0/credits", func(w http.ResponseWriter, r *http.Request) {
		var c credit
		json.NewDecoder(r.Body).Decode(&c)
		n, err := s.Credit(r.Context(), c.TenantID, c.AccountID, c.Amount)
		if err != nil {
			http.Error(w, "not found", 404)
			return
		}
		writeJSON(w, 200, map[string]int64{"balance": n})
	})
	mux.HandleFunc("POST /v1/credits", func(w http.ResponseWriter, r *http.Request) {
		var c credit
		json.NewDecoder(r.Body).Decode(&c)
		n, err := s.Credit(r.Context(), Who(r).TenantID, c.AccountID, c.Amount)
		if err != nil {
			http.Error(w, "not found", 404)
			return
		}
		writeJSON(w, 200, map[string]int64{"balance": n})
	})
	return s.Authn(mux)
}
