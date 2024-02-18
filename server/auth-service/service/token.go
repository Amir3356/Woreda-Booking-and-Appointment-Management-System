package service

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/woreda/booking/auth-service/model"
)

// TokenTTL is the access token lifetime.
const TokenTTL = 12 * time.Hour

// claims are the JWT claims verified by the gateway and every service middleware
// (sub, jti, name, role, dept).
type claims struct {
	Name         string `json:"name"`
	Role         string `json:"role"`
	DepartmentID string `json:"dept,omitempty"`
	jwt.RegisteredClaims
}

func issueToken(secret []byte, u *model.User) (string, error) {
	dept := ""
	if u.DepartmentID != nil {
		dept = *u.DepartmentID
	}
	jti := make([]byte, 8)
	_, _ = rand.Read(jti)
	now := time.Now()
	c := claims{
		Name: u.FullName, Role: string(u.Role), DepartmentID: dept,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        hex.EncodeToString(jti),
			Subject:   u.ID,
			Issuer:    "woreda-auth-service",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(TokenTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(secret)
}
