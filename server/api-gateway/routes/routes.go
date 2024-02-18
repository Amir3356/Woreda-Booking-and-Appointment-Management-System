// Package routes maps API path prefixes to upstream services.
package routes

import (
	"log/slog"
	"net/http"

	"github.com/woreda/booking/api-gateway/config"
	"github.com/woreda/booking/api-gateway/proxy"
)

// Register wires every API.md module prefix onto the matching service proxy.
func Register(mux *http.ServeMux, svc config.Services, logger *slog.Logger) error {
	table := map[string]string{
		"/api/v1/auth":             svc.Auth,
		"/api/v1/citizen":          svc.User,
		"/api/v1/admin/users":      svc.User,
		"/api/v1/admin/settings":   svc.User,
		"/api/v1/admin/audit-logs": svc.Audit,
		"/api/v1/departments":      svc.Department,
		"/api/v1/services":         svc.Department,
		"/api/v1/appointments":     svc.Appointment,
		"/api/v1/reports":          svc.Appointment,
		"/api/v1/schedules":        svc.Booking,
		"/api/v1/queue":            svc.Booking,
	}
	for prefix, target := range table {
		p, err := proxy.New(target, logger)
		if err != nil {
			return err
		}
		mux.Handle(prefix, p)     // exact collection path
		mux.Handle(prefix+"/", p) // subtree
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"message":"ok"}`))
	})
	return nil
}
