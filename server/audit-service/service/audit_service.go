package service

import (
	"context"

	"github.com/woreda/booking/audit-service/model"
)

// Repository defines persistence methods needed by audit service.
type Repository interface {
	List(ctx context.Context, action, role string, limit, offset int) ([]model.AuditLog, int, error)
	Record(ctx context.Context, l *model.AuditLog) error
}

// Service handles audit log retrieval and event recording.
type Service struct {
	repo Repository
}

// New returns an instantiated audit Service.
func New(repo Repository) *Service {
	return &Service{repo: repo}
}

// List returns paginated audit logs.
func (s *Service) List(ctx context.Context, action, role string, page, perPage int) ([]model.AuditLog, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.List(ctx, action, role, perPage, offset)
}

// Record saves a single audit event.
func (s *Service) Record(ctx context.Context, l *model.AuditLog) error {
	return s.repo.Record(ctx, l)
}

