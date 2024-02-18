// Package routes wires auth-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/auth-service/controller"
	"github.com/woreda/booking/auth-service/middleware"
)

// Register mounts /api/v1/auth endpoints and returns the middleware-wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	signedIn := middleware.RequireRole("CITIZEN", "OFFICER", "ADMIN")

	mux.HandleFunc("POST /api/v1/auth/register", c.Register) // public
	mux.HandleFunc("POST /api/v1/auth/login", c.Login)       // public
	mux.HandleFunc("GET /api/v1/auth/me", signedIn(c.Me))
	mux.HandleFunc("POST /api/v1/auth/logout", signedIn(c.Logout))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
