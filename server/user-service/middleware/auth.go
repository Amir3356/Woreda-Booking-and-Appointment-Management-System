// Package middleware provides JWT authentication, role checks, request logging and panic recovery.
package middleware

import (
	"net/http"
	"slices"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"github.com/woreda/booking/user-service/model"
)

// claims mirrors the JWT issued by auth-service (sub, jti, name, role, dept).
type claims struct {
	Name         string `json:"name"`
	Role         string `json:"role"`
	DepartmentID string `json:"dept,omitempty"`
	jwt.RegisteredClaims
}

// Authenticate validates an HS256 Bearer token with secret and stores the caller in the request
// context. Requests with no (or an invalid) token continue anonymously; RequireRole decides
// whether a route needs a signed-in user, so public API.md routes keep working.
func Authenticate(secret string) func(http.Handler) http.Handler {
	key := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if ok && raw != "" {
				c := &claims{}
				_, err := jwt.ParseWithClaims(raw, c, func(*jwt.Token) (any, error) { return key, nil },
					jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
				if err == nil {
					r = r.WithContext(model.WithCaller(r.Context(), model.Caller{
						UserID: c.Subject, Role: c.Role, Name: c.Name, DepartmentID: c.DepartmentID, TokenID: c.ID,
					}))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole rejects anonymous callers (401) and callers whose role is not listed (403).
// With no roles, any authenticated user is accepted.
func RequireRole(roles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			c := model.CallerFrom(r.Context())
			switch {
			case !c.Authenticated():
				writeError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing or expired bearer token.")
			case len(roles) > 0 && !slices.Contains(roles, c.Role):
				writeError(w, r, http.StatusForbidden, "FORBIDDEN", "Insufficient role permissions.")
			default:
				next(w, r)
			}
		}
	}
}
