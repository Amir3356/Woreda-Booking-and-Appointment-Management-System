// Package routes wires department-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/department-service/controller"
	"github.com/woreda/booking/department-service/middleware"
)

// Register mounts /departments and /services endpoints and returns the wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	admin := middleware.RequireRole("ADMIN")

	mux.HandleFunc("GET /api/v1/departments", c.ListDepartments) // public
	mux.HandleFunc("POST /api/v1/departments", admin(c.CreateDepartment))
	mux.HandleFunc("PUT /api/v1/departments/{id}", admin(c.UpdateDepartment))
	mux.HandleFunc("PATCH /api/v1/departments/{id}/status", admin(c.ToggleDepartment))
	mux.HandleFunc("DELETE /api/v1/departments/{id}", admin(c.DeleteDepartment))

	mux.HandleFunc("GET /api/v1/services", c.ListServices) // public
	mux.HandleFunc("POST /api/v1/services", admin(c.CreateService))
	mux.HandleFunc("PUT /api/v1/services/{id}", admin(c.UpdateService))
	mux.HandleFunc("PATCH /api/v1/services/{id}/status", admin(c.ToggleService))
	mux.HandleFunc("DELETE /api/v1/services/{id}", admin(c.DeleteService))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
