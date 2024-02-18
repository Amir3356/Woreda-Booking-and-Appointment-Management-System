// Package routes wires booking-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/booking-service/controller"
	"github.com/woreda/booking/booking-service/middleware"
)

// Register mounts /schedules and /queue endpoints and returns the wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	admin := middleware.RequireRole("ADMIN")
	staff := middleware.RequireRole("ADMIN", "OFFICER")
	officer := middleware.RequireRole("OFFICER")

	mux.HandleFunc("GET /api/v1/schedules", staff(c.ListSchedules))
	mux.HandleFunc("POST /api/v1/schedules", admin(c.CreateSchedule))
	mux.HandleFunc("GET /api/v1/schedules/availability", c.Availability) // public

	mux.HandleFunc("POST /api/v1/queue/verify-checkin", officer(c.CheckIn))
	mux.HandleFunc("GET /api/v1/queue", officer(c.Board))
	mux.HandleFunc("POST /api/v1/queue/call-next", officer(c.CallNext))
	mux.HandleFunc("PATCH /api/v1/queue/{id}/status", officer(c.Finalize))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
