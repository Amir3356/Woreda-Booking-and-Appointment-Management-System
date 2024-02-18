// Package model holds auth-service domain types (Database.md: users, user_role).
package model

import "time"

// Role mirrors the user_role enum.
type Role string

const (
	RoleCitizen Role = "CITIZEN"
	RoleOfficer Role = "OFFICER"
	RoleAdmin   Role = "ADMIN"
)

// User mirrors the users table (password hash never serialized).
type User struct {
	ID             string    `json:"id"`
	FullName       string    `json:"fullName"`
	Email          string    `json:"email"`
	Phone          string    `json:"phone"`
	PasswordHash   string    `json:"-"`
	NationalID     string    `json:"nationalId"`
	Role           Role      `json:"role"`
	DepartmentID   *string   `json:"departmentId"`
	DepartmentName *string   `json:"departmentName,omitempty"`
	CounterNumber  *int      `json:"counterNumber,omitempty"`
	Address        *string   `json:"address,omitempty"`
	IsActive       bool      `json:"isActive"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// RegisterRequest is the body of POST /auth/register.
type RegisterRequest struct {
	FullName    string `json:"fullName"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	NationalID  string `json:"nationalId"`
	Kebele      string `json:"kebele"`
	HouseNumber string `json:"houseNumber"`
	Password    string `json:"password"`
}

// LoginRequest is the body of POST /auth/login. Role is optional client context.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"`
}

// AuthResponse is returned by register and login.
type AuthResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}
