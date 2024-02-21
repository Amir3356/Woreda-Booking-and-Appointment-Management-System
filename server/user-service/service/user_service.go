// Package service holds user-service business rules.
package service

import (
	"context"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/woreda/booking/user-service/model"
	"github.com/woreda/booking/user-service/utils"
)

// Repository is the persistence port this service needs (implemented by repository.Repository).
type Repository interface {
	GetProfile(ctx context.Context, userID string) (*model.CitizenProfile, error)
	UpdateProfile(ctx context.Context, userID string, p model.CitizenProfile) error
	ListStaff(ctx context.Context, search string, offset, limit int) ([]model.StaffAccount, int, error)
	CreateStaff(ctx context.Context, fullName, email, hash string, role model.Role, deptID *string) (string, error)
	ToggleStaffStatus(ctx context.Context, id string) (bool, error)
	DeleteStaff(ctx context.Context, id string) error
	GetSettings(ctx context.Context) (*model.Settings, error)
	SaveSettings(ctx context.Context, s model.Settings) error
}

// Service implements profile, staff provisioning and settings use cases.
type Service struct{ repo Repository }

// New builds a Service.
func New(repo Repository) *Service { return &Service{repo: repo} }

// Profile returns the citizen's profile.
func (s *Service) Profile(ctx context.Context, userID string) (*model.CitizenProfile, error) {
	return s.repo.GetProfile(ctx, userID)
}

// UpdateProfile validates and saves the citizen's profile.
func (s *Service) UpdateProfile(ctx context.Context, userID string, p model.CitizenProfile) (*model.CitizenProfile, error) {
	p.FullName, p.Phone, p.Address = strings.TrimSpace(p.FullName), strings.TrimSpace(p.Phone), strings.TrimSpace(p.Address)
	v := &ValidationError{}
	if len(p.FullName) < 3 {
		v.add("fullName", "Full name is required (min 3 characters).")
	}
	if !utils.IsValidEthiopianPhone(p.Phone) {
		v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).")
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateProfile(ctx, userID, p); err != nil {
		return nil, err
	}
	return &p, nil
}

// ListStaff returns a cursor page of staff accounts.
func (s *Service) ListStaff(ctx context.Context, search string, cursor, pageSize int) ([]model.StaffAccount, model.Cursor, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 5
	}
	cursor = max(cursor, 0)
	items, total, err := s.repo.ListStaff(ctx, strings.TrimSpace(search), cursor, pageSize)
	c := model.Cursor{Current: cursor, PageSize: pageSize, TotalCount: total,
		HasPrev: cursor > 0, HasNext: cursor+pageSize < total}
	return items, c, err
}

// Provision creates an officer or administrator account.
func (s *Service) Provision(ctx context.Context, req model.ProvisionRequest) (string, error) {
	v := &ValidationError{}
	var role model.Role
	switch req.Role {
	case model.LabelOfficer, string(model.RoleOfficer):
		role = model.RoleOfficer
	case model.LabelAdmin, string(model.RoleAdmin):
		role = model.RoleAdmin
	default:
		v.add("role", `Role must be "Department Officer" or "Central Administrator".`)
	}
	if len(strings.TrimSpace(req.FullName)) < 3 {
		v.add("fullName", "Full name is required (min 3 characters).")
	}
	if !utils.IsValidEmail(req.Email) {
		v.add("email", "A valid email address is required.")
	}
	if len(req.Password) < 8 {
		v.add("password", "Password must be at least 8 characters.")
	}
	var dept *string
	if req.DepartmentID != "" {
		dept = &req.DepartmentID
	} else if role == model.RoleOfficer {
		v.add("departmentId", "Officers must be assigned to a department.")
	}
	if err := v.err(); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return s.repo.CreateStaff(ctx, strings.TrimSpace(req.FullName), strings.TrimSpace(req.Email), string(hash), role, dept)
}

// ToggleStaffStatus activates/deactivates a staff account.
func (s *Service) ToggleStaffStatus(ctx context.Context, id string) (bool, error) {
	return s.repo.ToggleStaffStatus(ctx, id)
}

// DeleteStaff removes a staff account.
func (s *Service) DeleteStaff(ctx context.Context, id string) error {
	return s.repo.DeleteStaff(ctx, id)
}

// Settings returns municipal configuration.
func (s *Service) Settings(ctx context.Context) (*model.Settings, error) {
	return s.repo.GetSettings(ctx)
}

// UpdateSettings validates and saves municipal configuration.
func (s *Service) UpdateSettings(ctx context.Context, in model.Settings) (*model.Settings, error) {
	v := &ValidationError{}
	if strings.TrimSpace(in.WoredaName) == "" {
		v.add("woredaName", "Woreda name is required.")
	}
	if in.MaxParallelSlots <= 0 {
		in.MaxParallelSlots = 3
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	return &in, s.repo.SaveSettings(ctx, in)
}
