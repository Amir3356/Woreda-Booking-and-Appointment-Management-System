// Package service contains auth business logic: validation, hashing and token issuance.
package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/woreda/booking/auth-service/model"
	"github.com/woreda/booking/auth-service/utils"
)

// Repository is the persistence port this service needs (implemented by repository.UserRepository).
type Repository interface {
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByID(ctx context.Context, id string) (*model.User, error)
	Exists(ctx context.Context, email, nationalID string) (bool, error)
	Create(ctx context.Context, u *model.User) error
}

// SessionStore holds revoked tokens and failed-login counters (implemented by repository.SessionStore).
type SessionStore interface {
	RevokeToken(ctx context.Context, jti string, ttl time.Duration) error
	LoginFailures(ctx context.Context, email string) (int, error)
	RecordLoginFailure(ctx context.Context, email string, window time.Duration) error
	ClearLoginFailures(ctx context.Context, email string) error
}

// Login lockout policy: after MaxLoginFailures wrong passwords for one email, further attempts
// are refused until LoginLockoutWindow passes without another failure.
const (
	MaxLoginFailures   = 5
	LoginLockoutWindow = 15 * time.Minute
)

// AuthService implements registration, login and session lookup.
type AuthService struct {
	repo     Repository
	sessions SessionStore // nil when Redis is not configured
	secret   []byte
}

// New builds an AuthService. sessions may be nil, which disables revocation and lockout.
func New(repo Repository, sessions SessionStore, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, sessions: sessions, secret: []byte(jwtSecret)}
}

// Register creates a CITIZEN account and returns a session token.
func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.AuthResponse, error) {
	req.FullName, req.Email, req.Phone = strings.TrimSpace(req.FullName), strings.TrimSpace(req.Email), strings.TrimSpace(req.Phone)
	v := &ValidationError{}
	if len(req.FullName) < 3 {
		v.add("fullName", "Full name is required (min 3 characters).")
	}
	if !utils.IsValidEthiopianPhone(req.Phone) {
		v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).")
	}
	if !strings.Contains(req.Email, "@") {
		v.add("email", "A valid email address is required.")
	}
	if strings.TrimSpace(req.NationalID) == "" {
		v.add("nationalId", "National ID is required.")
	}
	if !utils.IsStrongPassword(req.Password) {
		v.add("password", "Password must be at least 8 characters and include a digit or symbol.")
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	exists, err := s.repo.Exists(ctx, req.Email, req.NationalID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("%w: email or national ID already registered", ErrConflict)
	}
	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}
	address := fmt.Sprintf("%s, House %s", req.Kebele, req.HouseNumber)
	u := &model.User{
		FullName: req.FullName, Email: req.Email, Phone: req.Phone, NationalID: req.NationalID,
		PasswordHash: hash, Role: model.RoleCitizen, Address: &address,
	}
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return s.session(u)
}

// Login verifies credentials for any role.
// Store errors are logged and ignored so a Redis outage never blocks sign-in.
func (s *AuthService) Login(ctx context.Context, req model.LoginRequest) (*model.AuthResponse, error) {
	email := strings.TrimSpace(req.Email)
	if s.sessions != nil {
		n, err := s.sessions.LoginFailures(ctx, email)
		if err != nil {
			slog.Warn("login lockout check unavailable", "err", err)
		} else if n >= MaxLoginFailures {
			return nil, fmt.Errorf("%w: too many failed sign-in attempts, try again in %d minutes",
				ErrTooManyAttempts, int(LoginLockoutWindow.Minutes()))
		}
	}
	u, err := s.repo.GetByEmail(ctx, email)
	if err != nil || !utils.CheckPasswordHash(req.Password, u.PasswordHash) {
		if s.sessions != nil {
			if err := s.sessions.RecordLoginFailure(ctx, email, LoginLockoutWindow); err != nil {
				slog.Warn("record login failure", "err", err)
			}
		}
		return nil, fmt.Errorf("%w: invalid email or password", ErrUnauthorized)
	}
	if !u.IsActive {
		return nil, fmt.Errorf("%w: account is deactivated", ErrUnauthorized)
	}
	if s.sessions != nil {
		if err := s.sessions.ClearLoginFailures(ctx, email); err != nil {
			slog.Warn("clear login failures", "err", err)
		}
	}
	return s.session(u)
}

// Me returns the profile of the authenticated user.
func (s *AuthService) Me(ctx context.Context, userID string) (*model.User, error) {
	return s.repo.GetByID(ctx, userID)
}

// Logout invalidates the session identified by the token's jti. The jti is denylisted in Redis
// for the token's full lifetime (an upper bound on what remains); the api-gateway rejects it.
func (s *AuthService) Logout(ctx context.Context, caller model.Caller) error {
	if s.sessions == nil || caller.TokenID == "" {
		return nil
	}
	return s.sessions.RevokeToken(ctx, caller.TokenID, TokenTTL)
}

func (s *AuthService) session(u *model.User) (*model.AuthResponse, error) {
	token, err := issueToken(s.secret, u)
	if err != nil {
		return nil, err
	}
	return &model.AuthResponse{Token: token, User: u}, nil
}
