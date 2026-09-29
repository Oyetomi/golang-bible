package acl

import (
	"encoding/json"
	"net/http"
	"time"
)

// ProfileRoutes serves the profile editor and the admin's rule panel. v0 checks a cached copy of the rules
// (the flaw); v1 folds the check into the write (the fix). The range's fix lab asks you to make v0 behave like v1.
func (s *Store) ProfileRoutes(cache *RulesCache) http.Handler {
	mux := http.NewServeMux()
	update := func(guarded bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			me, target := Who(r), r.PathValue("id")
			var tenant string
			if err := s.Pool.QueryRow(r.Context(), `SELECT tenant_id FROM users WHERE id=$1`, target).Scan(&tenant); err != nil || tenant != me.TenantID {
				http.Error(w, "not found", 404)
				return
			}
			var changes map[string]string
			if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<14)).Decode(&changes) != nil || len(changes) == 0 {
				http.Error(w, "bad request", 400)
				return
			}
			var err error
			if guarded {
				err = s.UpdateGuarded(r.Context(), target, changes)
			} else {
				err = s.UpdateCachedCheck(r.Context(), cache, target, changes)
			}
			if err != nil {
				http.Error(w, "forbidden", 403)
				return
			}
			w.Write([]byte("updated\n"))
		}
	}
	mux.HandleFunc("PUT /v0/profiles/{id}", update(false))
	mux.HandleFunc("PUT /v1/profiles/{id}", update(true))
	// The admin's panel: only an admin may change a rule.
	mux.HandleFunc("POST /admin/rules", func(w http.ResponseWriter, r *http.Request) {
		if Who(r).Role != "admin" {
			http.Error(w, "forbidden", 403)
			return
		}
		field, editable := r.URL.Query().Get("field"), r.URL.Query().Get("editable") == "true"
		if _, ok := profileFields[field]; !ok {
			http.Error(w, "unknown field", 400)
			return
		}
		if err := s.SetRule(r.Context(), field, editable); err != nil {
			http.Error(w, "error", 500)
			return
		}
		w.Write([]byte("rule set\n"))
	})
	return s.Authn(mux)
}

// NewRulesCache is the cache the range uses: five seconds is long enough to see by hand.
func (s *Store) NewRulesCache(ttl time.Duration) *RulesCache {
	return &RulesCache{TTL: ttl, Refresh: s.LoadRules}
}
