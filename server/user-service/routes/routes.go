// Package routes wires user-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/user-service/controller"
	"github.com/woreda/booking/user-service/middleware"
)

// Register mounts citizen profile, staff provisioning and settings endpoints and returns
// the middleware-wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	citizen := middleware.RequireRole("CITIZEN")
	admin := middleware.RequireRole("ADMIN")

	mux.HandleFunc("GET /api/v1/citizen/profile", citizen(c.GetProfile))
	mux.HandleFunc("PUT /api/v1/citizen/profile", citizen(c.UpdateProfile))

	mux.HandleFunc("GET /api/v1/admin/users", admin(c.ListStaff))
	mux.HandleFunc("POST /api/v1/admin/users/provision", admin(c.Provision))
	mux.HandleFunc("PATCH /api/v1/admin/users/{id}/status", admin(c.ToggleStaffStatus))
	mux.HandleFunc("DELETE /api/v1/admin/users/{id}", admin(c.DeleteStaff))

	mux.HandleFunc("GET /api/v1/admin/settings", admin(c.GetSettings))
	mux.HandleFunc("PUT /api/v1/admin/settings", admin(c.UpdateSettings))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
