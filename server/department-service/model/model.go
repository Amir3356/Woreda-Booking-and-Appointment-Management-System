// Package model holds department-service types (Database.md: departments, services).
package model

import "time"

// Department mirrors the departments table plus derived counts.
type Department struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Code         string    `json:"code"`
	Description  string    `json:"description"`
	BuildingRoom string    `json:"buildingRoom"`
	ContactPhone string    `json:"contactPhone"`
	IsActive     bool      `json:"isActive"`
	OfficerCount int       `json:"officerCount"`
	ServiceCount int       `json:"serviceCount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// DepartmentInput is the body of POST/PUT /departments.
type DepartmentInput struct {
	Name         string `json:"name"`
	Code         string `json:"code"`
	Description  string `json:"description"`
	BuildingRoom string `json:"buildingRoom"`
	ContactPhone string `json:"contactPhone"`
}

// Service mirrors the services table.
type Service struct {
	ID                string    `json:"id"`
	DepartmentID      string    `json:"departmentId"`
	Name              string    `json:"name"`
	Code              string    `json:"code"`
	Description       string    `json:"description"`
	DurationMinutes   int       `json:"durationMinutes"`
	DailyQuota        int       `json:"dailyQuota"`
	FeeETB            float64   `json:"feeETB"`
	ProcessingDays    string    `json:"processingDays"`
	RequiredDocuments []string  `json:"requiredDocuments"`
	IsActive          bool      `json:"isActive"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// ServiceInput is the body of POST/PUT /services.
type ServiceInput struct {
	DepartmentID      string   `json:"departmentId"`
	Name              string   `json:"name"`
	Code              string   `json:"code"`
	Description       string   `json:"description"`
	DurationMinutes   int      `json:"durationMinutes"`
	DailyQuota        int      `json:"dailyQuota"`
	FeeETB            float64  `json:"feeETB"`
	ProcessingDays    string   `json:"processingDays"`
	RequiredDocuments []string `json:"requiredDocuments"`
}

// ServiceFilter holds GET /services query params.
type ServiceFilter struct {
	DepartmentID string
	Search       string
	IsActive     *bool
}
