// Package controller exposes user-service HTTP endpoints.
package controller

import (
	"net/http"
	"strconv"

	"github.com/woreda/booking/user-service/model"
	"github.com/woreda/booking/user-service/service"
)

// Controller serves citizen profile, staff provisioning and settings endpoints.
type Controller struct{ svc *service.Service }

// New builds a Controller.
func New(svc *service.Service) *Controller { return &Controller{svc: svc} }

// GetProfile handles GET /citizen/profile.
func (ctl *Controller) GetProfile(w http.ResponseWriter, r *http.Request) {
	id := model.CallerFrom(r.Context())
	p, err := ctl.svc.Profile(r.Context(), id.UserID)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Profile retrieved successfully.", p)
}

// UpdateProfile handles PUT /citizen/profile.
func (ctl *Controller) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	id := model.CallerFrom(r.Context())
	var in model.CitizenProfile
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	p, err := ctl.svc.UpdateProfile(r.Context(), id.UserID, in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Profile updated successfully.", p)
}

// ListStaff handles GET /admin/users.
func (ctl *Controller) ListStaff(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	cursor, _ := strconv.Atoi(q.Get("cursor"))
	size, _ := strconv.Atoi(q.Get("pageSize"))
	items, c, err := ctl.svc.ListStaff(r.Context(), q.Get("search"), cursor, size)
	if err != nil {
		fail(w, r, err)
		return
	}
	OKWithMeta(w, "Accounts retrieved successfully.", items, map[string]any{"cursor": c})
}

// Provision handles POST /admin/users/provision.
func (ctl *Controller) Provision(w http.ResponseWriter, r *http.Request) {
	var req model.ProvisionRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	id, err := ctl.svc.Provision(r.Context(), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusCreated, "Staff account provisioned successfully.", map[string]string{"id": id})
}

// ToggleStaffStatus handles PATCH /admin/users/{id}/status.
func (ctl *Controller) ToggleStaffStatus(w http.ResponseWriter, r *http.Request) {
	active, err := ctl.svc.ToggleStaffStatus(r.Context(), r.PathValue("id"))
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Account status updated.", map[string]any{"id": r.PathValue("id"), "isActive": active})
}

// DeleteStaff handles DELETE /admin/users/{id}.
func (ctl *Controller) DeleteStaff(w http.ResponseWriter, r *http.Request) {
	if err := ctl.svc.DeleteStaff(r.Context(), r.PathValue("id")); err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Account deleted.", nil)
}

// GetSettings handles GET /admin/settings.
func (ctl *Controller) GetSettings(w http.ResponseWriter, r *http.Request) {
	s, err := ctl.svc.Settings(r.Context())
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Settings retrieved successfully.", s)
}

// UpdateSettings handles PUT /admin/settings.
func (ctl *Controller) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var in model.Settings
	if err := decode(r, &in); err != nil {
		badRequest(w, r, err)
		return
	}
	s, err := ctl.svc.UpdateSettings(r.Context(), in)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Settings updated successfully.", s)
}
