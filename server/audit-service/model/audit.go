package model

import "time"

// AuditLog represents a persisted security/administrative audit log entry.
type AuditLog struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"userId,omitempty"`
	UserName  string    `json:"userName"`
	UserRole  string    `json:"userRole"`
	Action    string    `json:"action"`
	Entity    string    `json:"entity"`
	Details   *string   `json:"details,omitempty"`
	IPAddress string    `json:"ipAddress"`
	CreatedAt time.Time `json:"createdAt"`
}

