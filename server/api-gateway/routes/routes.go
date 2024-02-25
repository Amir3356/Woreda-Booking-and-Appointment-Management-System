// Package routes defines gateway endpoints and maps them to controllers.
package routes

import (
	"net/http"

	"github.com/woreda/booking/api-gateway/controller"
)

// Register defines all API Gateway endpoints and binds them to the GatewayController.
func Register(mux *http.ServeMux, c *controller.GatewayController) {
	// Authentication routes (/api/v1/auth) -> auth-service
	mux.HandleFunc("/api/v1/auth", c.ForwardAuth)
	mux.HandleFunc("/api/v1/auth/", c.ForwardAuth)

	// Citizen profile, staff provisioning, and system settings -> user-service
	mux.HandleFunc("/api/v1/citizen", c.ForwardUser)
	mux.HandleFunc("/api/v1/citizen/", c.ForwardUser)
	mux.HandleFunc("/api/v1/admin/users", c.ForwardUser)
	mux.HandleFunc("/api/v1/admin/users/", c.ForwardUser)
	mux.HandleFunc("/api/v1/admin/settings", c.ForwardUser)
	mux.HandleFunc("/api/v1/admin/settings/", c.ForwardUser)

	// Departments and service catalog -> department-service
	mux.HandleFunc("/api/v1/departments", c.ForwardDepartment)
	mux.HandleFunc("/api/v1/departments/", c.ForwardDepartment)
	mux.HandleFunc("/api/v1/services", c.ForwardDepartment)
	mux.HandleFunc("/api/v1/services/", c.ForwardDepartment)

	// Appointments lifecycle and reports -> appointment-service
	mux.HandleFunc("/api/v1/appointments", c.ForwardAppointment)
	mux.HandleFunc("/api/v1/appointments/", c.ForwardAppointment)
	mux.HandleFunc("/api/v1/reports", c.ForwardAppointment)
	mux.HandleFunc("/api/v1/reports/", c.ForwardAppointment)

	// Operating schedules and live counter queue -> booking-service
	mux.HandleFunc("/api/v1/schedules", c.ForwardBooking)
	mux.HandleFunc("/api/v1/schedules/", c.ForwardBooking)
	mux.HandleFunc("/api/v1/queue", c.ForwardBooking)
	mux.HandleFunc("/api/v1/queue/", c.ForwardBooking)

	// Gateway health probe
	mux.HandleFunc("GET /healthz", c.HealthCheck)
}
