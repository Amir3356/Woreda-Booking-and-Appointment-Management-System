package utils

import (
	"golang.org/x/crypto/bcrypt"
)

// DefaultBcryptCost is the cost parameter used for hashing passwords.
const DefaultBcryptCost = 12

// HashPassword hashes a raw password using bcrypt.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), DefaultBcryptCost)
	return string(bytes), err
}

// CheckPasswordHash compares a plaintext password with a bcrypt hash. Returns true if matching.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

