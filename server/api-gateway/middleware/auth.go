package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Identity headers forwarded to downstream services after JWT verification.
// Services trust these headers, so the gateway always strips client-supplied values.
const (
	HeaderUserID     = "X-User-ID"
	HeaderUserRole   = "X-User-Role"
	HeaderUserName   = "X-User-Name"
	HeaderDepartment = "X-User-Department"
)

// Claims mirrors the JWT claims issued by auth-service.
type Claims struct {
	Name         string `json:"name"`
	Role         string `json:"role"`
	DepartmentID string `json:"dept,omitempty"`
	jwt.RegisteredClaims
}

// publicRoutes lists API.md endpoints marked "Public" (or "Public / Authenticated").
// On these routes a token is optional; if present and valid, identity is still forwarded.
var publicRoutes = func() *http.ServeMux {
	m := http.NewServeMux()
	noop := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})
	for _, p := range []string{
		"GET /healthz",
		"POST /api/v1/auth/register",
		"POST /api/v1/auth/login",
		"GET /api/v1/departments",
		"GET /api/v1/services",
		"GET /api/v1/schedules/availability",
		"POST /api/v1/appointments",
		"GET /api/v1/appointments/track",
		"GET /api/v1/appointments/{id}/slip",
	} {
		m.Handle(p, noop)
	}
	return m
}()

func isPublic(r *http.Request) bool {
	_, pattern := publicRoutes.Handler(r)
	return pattern != ""
}

// Auth verifies the bearer JWT and forwards identity headers to upstream services.
func Auth(secret string) Middleware {
	key := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, h := range []string{HeaderUserID, HeaderUserRole, HeaderUserName, HeaderDepartment} {
				r.Header.Del(h)
			}
			public := isPublic(r)
			claims, err := parseBearer(r, key)
			if err != nil && !public {
				WriteError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing or expired bearer token.")
				return
			}
			if claims != nil {
				r.Header.Set(HeaderUserID, claims.Subject)
				r.Header.Set(HeaderUserRole, claims.Role)
				r.Header.Set(HeaderUserName, claims.Name)
				r.Header.Set(HeaderDepartment, claims.DepartmentID)
			}
			next.ServeHTTP(w, r)
		})
	}
}

func parseBearer(r *http.Request, key []byte) (*Claims, error) {
	raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		// Fallback: check JWT stored in browser cookie "woreda_token"
		if cookie, err := r.Cookie("woreda_token"); err == nil && cookie.Value != "" {
			raw = cookie.Value
		} else {
			return nil, errors.New("missing bearer token")
		}
	}
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) { return key, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}
	return claims, nil
}
