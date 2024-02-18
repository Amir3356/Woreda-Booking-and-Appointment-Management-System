// Package controller exposes booking-service HTTP endpoints.
package controller

import (
	"fmt"
	"net/http"

	"github.com/woreda/booking/booking-service/model"
	"github.com/woreda/booking/booking-service/service"
)

// Controller serves /schedules and /queue.
type Controller struct{ svc *service.Service }

// New builds a Controller.
func New(svc *service.Service) *Controller { return &Controller{svc: svc} }

// ListSchedules handles GET /schedules.
func (ctl *Controller) ListSchedules(w http.ResponseWriter, r *http.Request) {
	list, err := ctl.svc.ListSchedules(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Schedules retrieved successfully.", list)
}

// CreateSchedule handles POST /schedules.
func (ctl *Controller) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	var in model.ScheduleInput
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	sc, err := ctl.svc.CreateSchedule(r.Context(), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusCreated, "Schedule created successfully.", sc)
}

// Availability handles GET /schedules/availability?serviceId=&date=.
func (ctl *Controller) Availability(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	a, err := ctl.svc.Availability(r.Context(), q.Get("serviceId"), q.Get("date"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Availability calculated.", a)
}

// CheckIn handles POST /queue/verify-checkin.
func (ctl *Controller) CheckIn(w http.ResponseWriter, r *http.Request) {
	var req model.CheckInRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	res, err := ctl.svc.CheckIn(r.Context(), model.CallerFrom(r.Context()), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Citizen checked in and queue token issued.", res)
}

// Board handles GET /queue.
func (ctl *Controller) Board(w http.ResponseWriter, r *http.Request) {
	b, err := ctl.svc.Board(r.Context(), model.CallerFrom(r.Context()), r.URL.Query().Get("departmentId"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Queue retrieved successfully.", b)
}

// CallNext handles POST /queue/call-next.
func (ctl *Controller) CallNext(w http.ResponseWriter, r *http.Request) {
	var req model.CallNextRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	res, err := ctl.svc.CallNext(r.Context(), model.CallerFrom(r.Context()), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, fmt.Sprintf("Token %s called to Counter #%d.", res.CalledToken, res.CounterNumber), res)
}

// Finalize handles PATCH /queue/{id}/status.
func (ctl *Controller) Finalize(w http.ResponseWriter, r *http.Request) {
	var req model.FinalizeRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	if err := ctl.svc.Finalize(r.Context(), model.CallerFrom(r.Context()), r.PathValue("id"), req); err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Queue token finalized.", map[string]any{"id": r.PathValue("id"), "status": req.Status})
}
