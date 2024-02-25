// Package service holds department & service catalog business rules.
package service

import (
	"context"
	"strings"

	"github.com/woreda/booking/department-service/model"
)

// Repository is the persistence port this service needs (implemented by repository.Repository).
type Repository interface {
	ListDepartments(ctx context.Context, isActive *bool) ([]model.Department, error)
	GetDepartment(ctx context.Context, id string) (*model.Department, error)
	CreateDepartment(ctx context.Context, in model.DepartmentInput) (string, error)
	UpdateDepartment(ctx context.Context, id string, in model.DepartmentInput) error
	ToggleDepartmentStatus(ctx context.Context, id string) (bool, error)
	DeleteDepartment(ctx context.Context, id string) error
	ListServices(ctx context.Context, f model.ServiceFilter) ([]model.Service, error)
	GetService(ctx context.Context, id string) (*model.Service, error)
	CreateService(ctx context.Context, in model.ServiceInput) (string, error)
	UpdateService(ctx context.Context, id string, in model.ServiceInput) error
	ToggleServiceStatus(ctx context.Context, id string) (bool, error)
	DeleteService(ctx context.Context, id string) error
}

// Publisher announces catalog changes (Kafka, see the events package). Fire-and-forget:
// a broker outage never fails an admin's change.
type Publisher interface {
	Publish(ctx context.Context, eventType, entityID string, data any)
}

// NopPublisher discards events (used when KAFKA_BROKERS is unset).
type NopPublisher struct{}

// Publish does nothing.
func (NopPublisher) Publish(context.Context, string, string, any) {}

// Service implements department and catalog use cases.
type Service struct {
	repo   Repository
	events Publisher
}

// New builds a Service.
func New(repo Repository, events Publisher) *Service { return &Service{repo: repo, events: events} }

// ListDepartments lists departments.
func (s *Service) ListDepartments(ctx context.Context, isActive *bool) ([]model.Department, error) {
	return s.repo.ListDepartments(ctx, isActive)
}

// CreateDepartment validates and creates a department.
func (s *Service) CreateDepartment(ctx context.Context, in model.DepartmentInput) (*model.Department, error) {
	if err := validateDepartment(&in); err != nil {
		return nil, err
	}
	id, err := s.repo.CreateDepartment(ctx, in)
	if err != nil {
		return nil, err
	}
	d, err := s.repo.GetDepartment(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.department.created", id, d)
	}
	return d, err
}

// UpdateDepartment validates and updates a department.
func (s *Service) UpdateDepartment(ctx context.Context, id string, in model.DepartmentInput) (*model.Department, error) {
	if err := validateDepartment(&in); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateDepartment(ctx, id, in); err != nil {
		return nil, err
	}
	d, err := s.repo.GetDepartment(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.department.updated", id, d)
	}
	return d, err
}

// ToggleDepartment flips a department's active flag.
func (s *Service) ToggleDepartment(ctx context.Context, id string) (bool, error) {
	active, err := s.repo.ToggleDepartmentStatus(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.department.status_changed", id, map[string]bool{"isActive": active})
	}
	return active, err
}

// DeleteDepartment removes a department.
func (s *Service) DeleteDepartment(ctx context.Context, id string) error {
	err := s.repo.DeleteDepartment(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.department.deleted", id, nil)
	}
	return err
}

// ListServices lists catalog services.
func (s *Service) ListServices(ctx context.Context, f model.ServiceFilter) ([]model.Service, error) {
	return s.repo.ListServices(ctx, f)
}

// CreateService validates and creates a service.
func (s *Service) CreateService(ctx context.Context, in model.ServiceInput) (*model.Service, error) {
	if err := validateService(&in); err != nil {
		return nil, err
	}
	id, err := s.repo.CreateService(ctx, in)
	if err != nil {
		return nil, err
	}
	svc, err := s.repo.GetService(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.service.created", id, svc)
	}
	return svc, err
}

// UpdateService validates and updates a service.
func (s *Service) UpdateService(ctx context.Context, id string, in model.ServiceInput) (*model.Service, error) {
	if err := validateService(&in); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateService(ctx, id, in); err != nil {
		return nil, err
	}
	svc, err := s.repo.GetService(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.service.updated", id, svc)
	}
	return svc, err
}

// ToggleService flips a service's active flag.
func (s *Service) ToggleService(ctx context.Context, id string) (bool, error) {
	active, err := s.repo.ToggleServiceStatus(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.service.status_changed", id, map[string]bool{"isActive": active})
	}
	return active, err
}

// DeleteService removes a service.
func (s *Service) DeleteService(ctx context.Context, id string) error {
	err := s.repo.DeleteService(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "catalog.service.deleted", id, nil)
	}
	return err
}

func validateDepartment(in *model.DepartmentInput) error {
	in.Name, in.Code = strings.TrimSpace(in.Name), strings.ToUpper(strings.TrimSpace(in.Code))
	v := &ValidationError{}
	if in.Name == "" {
		v.add("name", "Department name is required.")
	}
	if in.Code == "" || len(in.Code) > 16 {
		v.add("code", "Code is required (max 16 characters).")
	}
	if strings.TrimSpace(in.BuildingRoom) == "" {
		v.add("buildingRoom", "Building/room is required.")
	}
	if strings.TrimSpace(in.ContactPhone) == "" {
		v.add("contactPhone", "Contact phone is required.")
	}
	return v.err()
}

func validateService(in *model.ServiceInput) error {
	in.Name, in.Code = strings.TrimSpace(in.Name), strings.ToUpper(strings.TrimSpace(in.Code))
	if in.DurationMinutes == 0 {
		in.DurationMinutes = 30
	}
	if in.DailyQuota == 0 {
		in.DailyQuota = 40
	}
	if in.ProcessingDays == "" {
		in.ProcessingDays = "Same day"
	}
	if in.RequiredDocuments == nil {
		in.RequiredDocuments = []string{}
	}
	v := &ValidationError{}
	if in.DepartmentID == "" {
		v.add("departmentId", "Parent department is required.")
	}
	if in.Name == "" {
		v.add("name", "Service name is required.")
	}
	if in.Code == "" {
		v.add("code", "Service code is required.")
	}
	if in.DurationMinutes < 0 || in.DailyQuota < 0 {
		v.add("durationMinutes", "Duration and daily quota must be positive.")
	}
	if in.FeeETB < 0 {
		v.add("feeETB", "Fee cannot be negative.")
	}
	return v.err()
}
