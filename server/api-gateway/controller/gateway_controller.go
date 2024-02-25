// Package controller coordinates incoming HTTP requests and directs them to the target microservices.
package controller

import (
	"log/slog"
	"net/http"
	"net/http/httputil"

	"github.com/woreda/booking/api-gateway/config"
	"github.com/woreda/booking/api-gateway/proxy"
)

// GatewayController is responsible for receiving incoming HTTP requests
// and coordinating how those requests are forwarded to the appropriate microservices.
type GatewayController struct {
	authProxy        *httputil.ReverseProxy
	userProxy        *httputil.ReverseProxy
	departmentProxy  *httputil.ReverseProxy
	appointmentProxy *httputil.ReverseProxy
	bookingProxy     *httputil.ReverseProxy
	logger           *slog.Logger
}

// New constructs a GatewayController initialized with reverse proxies for all registered microservices.
func New(svc config.Services, logger *slog.Logger) (*GatewayController, error) {
	authP, err := proxy.New(svc.Auth, logger)
	if err != nil {
		return nil, err
	}
	userP, err := proxy.New(svc.User, logger)
	if err != nil {
		return nil, err
	}
	deptP, err := proxy.New(svc.Department, logger)
	if err != nil {
		return nil, err
	}
	aptP, err := proxy.New(svc.Appointment, logger)
	if err != nil {
		return nil, err
	}
	bookingP, err := proxy.New(svc.Booking, logger)
	if err != nil {
		return nil, err
	}

	return &GatewayController{
		authProxy:        authP,
		userProxy:        userP,
		departmentProxy:  deptP,
		appointmentProxy: aptP,
		bookingProxy:     bookingP,
		logger:           logger,
	}, nil
}

// ForwardAuth receives incoming auth requests and coordinates forwarding to auth-service.
func (c *GatewayController) ForwardAuth(w http.ResponseWriter, r *http.Request) {
	c.authProxy.ServeHTTP(w, r)
}

// ForwardUser receives incoming citizen profile, staff accounts, and settings requests and coordinates forwarding to user-service.
func (c *GatewayController) ForwardUser(w http.ResponseWriter, r *http.Request) {
	c.userProxy.ServeHTTP(w, r)
}

// ForwardDepartment receives incoming department and public service catalog requests and coordinates forwarding to department-service.
func (c *GatewayController) ForwardDepartment(w http.ResponseWriter, r *http.Request) {
	c.departmentProxy.ServeHTTP(w, r)
}

// ForwardAppointment receives incoming appointment lifecycle and reporting requests and coordinates forwarding to appointment-service.
func (c *GatewayController) ForwardAppointment(w http.ResponseWriter, r *http.Request) {
	c.appointmentProxy.ServeHTTP(w, r)
}

// ForwardBooking receives incoming schedule availability and counter queue requests and coordinates forwarding to booking-service.
func (c *GatewayController) ForwardBooking(w http.ResponseWriter, r *http.Request) {
	c.bookingProxy.ServeHTTP(w, r)
}

// HealthCheck serves the gateway liveness and readiness probe.
func (c *GatewayController) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"success":true,"service":"api-gateway","status":"healthy"}`))
}

