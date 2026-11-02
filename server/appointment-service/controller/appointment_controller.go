// Package controller exposes appointment-service HTTP endpoints.
package controller

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"github.com/woreda/booking/appointment-service/model"
	"github.com/woreda/booking/appointment-service/service"
)

// Controller serves /appointments and /reports.
type Controller struct{ svc *service.Service }

// New builds a Controller.
func New(svc *service.Service) *Controller { return &Controller{svc: svc} }

func caller(r *http.Request) model.Caller { return model.CallerFrom(r.Context()) }

// Book handles POST /appointments.
func (ctl *Controller) Book(w http.ResponseWriter, r *http.Request) {
	var req model.BookRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	a, err := ctl.svc.Book(r.Context(), caller(r), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusCreated, "Appointment booked successfully.", a)
}

// Track handles GET /appointments/track?ref=.
func (ctl *Controller) Track(w http.ResponseWriter, r *http.Request) {
	res, err := ctl.svc.Track(r.Context(), r.URL.Query().Get("ref"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Appointment found.", res)
}

// Mine handles GET /appointments/my.
func (ctl *Controller) Mine(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, err := ctl.svc.Mine(r.Context(), caller(r), q.Get("tab"), q.Get("search"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Appointments retrieved successfully.", list)
}

func listFilter(r *http.Request) model.ListFilter {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	return model.ListFilter{Timeframe: q.Get("timeframe"), Status: q.Get("status"),
		DepartmentID: q.Get("departmentId"), Search: q.Get("search"), Page: page, Limit: limit}
}

// List handles GET /appointments (paginated registry).
func (ctl *Controller) List(w http.ResponseWriter, r *http.Request) {
	f := listFilter(r)
	list, total, err := ctl.svc.List(r.Context(), caller(r), f)
	if err != nil {
		fail(w, r, err)
		return
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 200 {
		f.Limit = 20
	}
	OKWithMeta(w, "List retrieved successfully.", list, map[string]any{"pagination": NewPagination(total, f.Page, f.Limit)})
}

// UpdateStatus handles PATCH /appointments/{id}/status.
func (ctl *Controller) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	var u model.StatusUpdate
	if err := decode(r, &u); err != nil {
		badRequest(w, r, err)
		return
	}
	a, err := ctl.svc.UpdateStatus(r.Context(), caller(r), r.PathValue("id"), u)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Appointment status updated to "+string(a.Status)+".", a)
}

// Reschedule handles POST /appointments/{id}/reschedule.
func (ctl *Controller) Reschedule(w http.ResponseWriter, r *http.Request) {
	var req model.RescheduleRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	a, err := ctl.svc.Reschedule(r.Context(), caller(r), r.PathValue("id"), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Appointment rescheduled.", a)
}

// Cancel handles POST /appointments/{id}/cancel.
func (ctl *Controller) Cancel(w http.ResponseWriter, r *http.Request) {
	if err := ctl.svc.Cancel(r.Context(), caller(r), r.PathValue("id")); err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Appointment cancelled.", map[string]string{"id": r.PathValue("id"), "status": "CANCELLED"})
}

// Slip handles GET /appointments/{id}/slip.
func (ctl *Controller) Slip(w http.ResponseWriter, r *http.Request) {
	slip, err := ctl.svc.Slip(r.Context(), r.PathValue("id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Slip generated.", slip)
}

// Summary handles GET /reports/summary.
func (ctl *Controller) Summary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	sum, err := ctl.svc.Summary(r.Context(), caller(r), q.Get("period"), q.Get("departmentId"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Summary retrieved successfully.", sum)
}

// ExportCSV handles GET /reports/export-csv.
// TODO: stream with a cursor instead of loading a capped page.
func (ctl *Controller) ExportCSV(w http.ResponseWriter, r *http.Request) {
	f := listFilter(r)
	f.Page, f.Limit = 1, 200
	list, _, err := ctl.svc.List(r.Context(), caller(r), f)
	if err != nil {
		fail(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="woreda_appointment_report.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"Reference", "Citizen", "Phone", "Department", "Service", "Date", "Time Slot", "Status"})
	for _, a := range list {
		_ = cw.Write([]string{a.ReferenceNumber, a.CitizenName, a.CitizenPhone, a.DepartmentName,
			a.ServiceName, a.Date, a.TimeSlot, string(a.Status)})
	}
	cw.Flush()
}
