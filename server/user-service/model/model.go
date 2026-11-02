// Package model holds user-service types (Database.md: users, system_settings).
package model

// Role mirrors the user_role enum.
type Role string

const (
	RoleCitizen Role = "CITIZEN"
	RoleOfficer Role = "OFFICER"
	RoleAdmin   Role = "ADMIN"
)

// Client-facing role labels used by the provisioning UI.
const (
	LabelOfficer = "Department Officer"
	LabelAdmin   = "Central Administrator"
)

// CitizenProfile is the body/response of /citizen/profile.
type CitizenProfile struct {
	FullName   string `json:"fullName"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	NationalID string `json:"nationalId"`
	Address    string `json:"address"`
}

// StaffAccount is a row in GET /admin/users.
type StaffAccount struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	Email          string  `json:"email"`
	Role           string  `json:"role"` // client label, e.g. "Department Officer"
	DepartmentID   *string `json:"departmentId"`
	DepartmentName *string `json:"departmentName"`
	IsActive       bool    `json:"isActive"`
}

// ProvisionRequest is the body of POST /admin/users/provision.
type ProvisionRequest struct {
	FullName     string `json:"fullName"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	Role         string `json:"role"`
	DepartmentID string `json:"departmentId"`
}

// Cursor is meta.cursor for cursor-paginated lists.
type Cursor struct {
	Current    int  `json:"current"`
	PageSize   int  `json:"pageSize"`
	TotalCount int  `json:"totalCount"`
	HasPrev    bool `json:"hasPrev"`
	HasNext    bool `json:"hasNext"`
}

// Settings mirrors system_settings (single 'primary' row).
type Settings struct {
	WoredaName              string `json:"woredaName"`
	CityRegion              string `json:"cityRegion"`
	Hotline                 string `json:"hotline"`
	EmergencyPhone          string `json:"emergencyPhone"` // reception_phone column
	SMSGatewayActive        bool   `json:"smsGatewayActive"`
	AutoApproveBookings     bool   `json:"autoApproveBookings"`
	AdvanceBookingDays      int    `json:"advanceBookingDays"`
	CancellationCutoffHours int    `json:"cancellationCutoffHours"`
	MaxParallelSlots        int    `json:"maxParallelSlots"`
}

// RoleLabel maps a DB role to the client label.
func RoleLabel(r Role) string {
	switch r {
	case RoleOfficer:
		return LabelOfficer
	case RoleAdmin:
		return LabelAdmin
	}
	return string(r)
}
