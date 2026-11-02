package model

import (
	"context"
	"errors"
	"slices"
)

// ErrNotFound is the shared "entity does not exist" sentinel (repository → service → controller).
var ErrNotFound = errors.New("not found")

// Caller is the authenticated user taken from verified JWT claims.
type Caller struct {
	UserID, Role, Name, DepartmentID, TokenID string
}

// Authenticated reports whether a verified user made the request.
func (c Caller) Authenticated() bool { return c.UserID != "" }

// HasRole reports whether the caller has one of roles.
func (c Caller) HasRole(roles ...string) bool { return slices.Contains(roles, c.Role) }

type callerKey struct{}

// WithCaller returns a context carrying c (set by middleware).
func WithCaller(ctx context.Context, c Caller) context.Context {
	return context.WithValue(ctx, callerKey{}, c)
}

// CallerFrom returns the caller stored in ctx, or the zero (anonymous) Caller.
func CallerFrom(ctx context.Context) Caller {
	c, _ := ctx.Value(callerKey{}).(Caller)
	return c
}

// ErrSlotFull is returned when a time slot reached system_settings.max_parallel_slots.
var ErrSlotFull = errors.New("slot full")
