package controller

import (
	"net/http"
	"strconv"

	"github.com/woreda/booking/audit-service/service"
)

// Controller exposes HTTP endpoints for audit log inspection.
type Controller struct {
	svc *service.Service
}

// New returns a Controller.
func New(svc *service.Service) *Controller {
	return &Controller{svc: svc}
}

// List handles GET /api/v1/admin/audit-logs.
func (c *Controller) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	action := q.Get("action")
	role := q.Get("role")
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	logs, total, err := c.svc.List(r.Context(), action, role, page, perPage)
	if err != nil {
		Fail(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve audit logs.")
		return
	}

	p := NewPagination(total, page, perPage)
	OKWithMeta(w, "Audit logs retrieved.", logs, map[string]any{
		"pagination": p,
	})
}
