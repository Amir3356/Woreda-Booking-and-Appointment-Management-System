// Package routes wires audit-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/audit-service/controller"
	"github.com/woreda/booking/audit-service/middleware"
)

// Register mounts /admin/audit-logs endpoints and returns the wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	admin := middleware.RequireRole("ADMIN")

	mux.HandleFunc("GET /api/v1/admin/audit-logs", admin(c.List))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
