// Package controller exposes department-service HTTP endpoints.
package controller

import (
	"net/http"
	"strconv"

	"github.com/woreda/booking/department-service/model"
	"github.com/woreda/booking/department-service/service"
)

// Controller serves /departments and /services.
type Controller struct{ svc *service.Service }

// New builds a Controller.
func New(svc *service.Service) *Controller { return &Controller{svc: svc} }

func boolParam(r *http.Request, key string) *bool {
	b, err := strconv.ParseBool(r.URL.Query().Get(key))
	if err != nil {
		return nil
	}
	return &b
}

// ListDepartments handles GET /departments (public).
func (ctl *Controller) ListDepartments(w http.ResponseWriter, r *http.Request) {
	list, err := ctl.svc.ListDepartments(r.Context(), boolParam(r, "isActive"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Departments retrieved successfully.", list)
}

// CreateDepartment handles POST /departments.
func (ctl *Controller) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	var in model.DepartmentInput
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	d, err := ctl.svc.CreateDepartment(r.Context(), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusCreated, "Department created successfully.", d)
}

// UpdateDepartment handles PUT /departments/{id}.
func (ctl *Controller) UpdateDepartment(w http.ResponseWriter, r *http.Request) {
	var in model.DepartmentInput
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	d, err := ctl.svc.UpdateDepartment(r.Context(), r.PathValue("id"), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Department updated successfully.", d)
}

// ToggleDepartment handles PATCH /departments/{id}/status.
func (ctl *Controller) ToggleDepartment(w http.ResponseWriter, r *http.Request) {
	active, err := ctl.svc.ToggleDepartment(r.Context(), r.PathValue("id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Department status updated.", map[string]any{"id": r.PathValue("id"), "isActive": active})
}

// DeleteDepartment handles DELETE /departments/{id}.
func (ctl *Controller) DeleteDepartment(w http.ResponseWriter, r *http.Request) {
	if err := ctl.svc.DeleteDepartment(r.Context(), r.PathValue("id")); err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Department deleted.", nil)
}

// ListServices handles GET /services (public).
func (ctl *Controller) ListServices(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, err := ctl.svc.ListServices(r.Context(), model.ServiceFilter{
		DepartmentID: q.Get("departmentId"), Search: q.Get("search"), IsActive: boolParam(r, "isActive"),
	})
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Services retrieved successfully.", list)
}

// CreateService handles POST /services.
func (ctl *Controller) CreateService(w http.ResponseWriter, r *http.Request) {
	var in model.ServiceInput
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	s, err := ctl.svc.CreateService(r.Context(), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusCreated, "Service created successfully.", s)
}

// UpdateService handles PUT /services/{id}.
func (ctl *Controller) UpdateService(w http.ResponseWriter, r *http.Request) {
	var in model.ServiceInput
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	s, err := ctl.svc.UpdateService(r.Context(), r.PathValue("id"), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Service updated successfully.", s)
}

// ToggleService handles PATCH /services/{id}/status.
func (ctl *Controller) ToggleService(w http.ResponseWriter, r *http.Request) {
	active, err := ctl.svc.ToggleService(r.Context(), r.PathValue("id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Service status updated.", map[string]any{"id": r.PathValue("id"), "isActive": active})
}

// DeleteService handles DELETE /services/{id}.
func (ctl *Controller) DeleteService(w http.ResponseWriter, r *http.Request) {
	if err := ctl.svc.DeleteService(r.Context(), r.PathValue("id")); err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Service deleted.", nil)
}
