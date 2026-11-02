package service

import (
	"errors"

	"github.com/woreda/booking/auth-service/model"
)

// Sentinel errors mapped to HTTP status codes by the handler layer.
var (
	ErrNotFound       = model.ErrNotFound
	ErrConflict       = errors.New("conflict")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrForbidden      = errors.New("forbidden")
	ErrNotImplemented = errors.New("not implemented")
)

// FieldIssue describes one invalid input field.
type FieldIssue struct{ Field, Issue string }

// ValidationError aggregates field-level validation failures (HTTP 422).
type ValidationError struct{ Issues []FieldIssue }

func (v *ValidationError) Error() string { return "validation failed" }

func (v *ValidationError) add(field, issue string) {
	v.Issues = append(v.Issues, FieldIssue{field, issue})
}

// err returns nil when no issues were recorded.
func (v *ValidationError) err() error {
	if len(v.Issues) == 0 {
		return nil
	}
	return v
}
