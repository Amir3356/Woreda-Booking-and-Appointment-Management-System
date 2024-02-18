// Package routes wires appointment-service controllers and middleware onto the mux.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/appointment-service/controller"
	"github.com/woreda/booking/appointment-service/middleware"
)

// Register mounts /appointments and /reports endpoints and returns the wrapped root handler.
func Register(mux *http.ServeMux, c *controller.Controller, jwtSecret string, logger *slog.Logger) http.Handler {
	signedIn := middleware.RequireRole("CITIZEN", "OFFICER", "ADMIN")
	citizen := middleware.RequireRole("CITIZEN")
	staff := middleware.RequireRole("OFFICER", "ADMIN")

	// Public / CITIZEN: the service requires a signed-in citizen because appointments.citizen_id is NOT NULL.
	mux.HandleFunc("POST /api/v1/appointments", c.Book)
	mux.HandleFunc("GET /api/v1/appointments/track", c.Track) // public
	mux.HandleFunc("GET /api/v1/appointments/my", citizen(c.Mine))
	mux.HandleFunc("GET /api/v1/appointments", staff(c.List))
	mux.HandleFunc("PATCH /api/v1/appointments/{id}/status", staff(c.UpdateStatus))
	mux.HandleFunc("POST /api/v1/appointments/{id}/reschedule", signedIn(c.Reschedule))
	mux.HandleFunc("POST /api/v1/appointments/{id}/cancel", signedIn(c.Cancel))
	mux.HandleFunc("GET /api/v1/appointments/{id}/slip", c.Slip) // public

	mux.HandleFunc("GET /api/v1/reports/summary", staff(c.Summary))
	mux.HandleFunc("GET /api/v1/reports/export-csv", staff(c.ExportCSV))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	return middleware.Recover(logger)(middleware.Logging(logger)(middleware.Authenticate(jwtSecret)(mux)))
}
