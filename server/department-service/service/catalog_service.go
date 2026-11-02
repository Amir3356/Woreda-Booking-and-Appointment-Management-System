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

// Service implements department and catalog use cases.
type Service struct{ repo Repository }

// New builds a Service.
func New(repo Repository) *Service { return &Service{repo: repo} }

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
	return s.repo.GetDepartment(ctx, id)
}

// UpdateDepartment validates and updates a department.
func (s *Service) UpdateDepartment(ctx context.Context, id string, in model.DepartmentInput) (*model.Department, error) {
	if err := validateDepartment(&in); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateDepartment(ctx, id, in); err != nil {
		return nil, err
	}
	return s.repo.GetDepartment(ctx, id)
}

// ToggleDepartment flips a department's active flag.
func (s *Service) ToggleDepartment(ctx context.Context, id string) (bool, error) {
	return s.repo.ToggleDepartmentStatus(ctx, id)
}

// DeleteDepartment removes a department.
func (s *Service) DeleteDepartment(ctx context.Context, id string) error {
	return s.repo.DeleteDepartment(ctx, id)
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
	return s.repo.GetService(ctx, id)
}

// UpdateService validates and updates a service.
func (s *Service) UpdateService(ctx context.Context, id string, in model.ServiceInput) (*model.Service, error) {
	if err := validateService(&in); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateService(ctx, id, in); err != nil {
		return nil, err
	}
	return s.repo.GetService(ctx, id)
}

// ToggleService flips a service's active flag.
func (s *Service) ToggleService(ctx context.Context, id string) (bool, error) {
	return s.repo.ToggleServiceStatus(ctx, id)
}

// DeleteService removes a service.
func (s *Service) DeleteService(ctx context.Context, id string) error {
	return s.repo.DeleteService(ctx, id)
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
