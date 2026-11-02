package utils

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// GenerateID returns a cryptographically random, prefixed identifier (e.g. "dept-1a2b3c4d5e6f").
func GenerateID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	prefix = strings.TrimSuffix(strings.TrimSpace(prefix), "-")
	if prefix == "" {
		return hex.EncodeToString(b)
	}
	return prefix + "-" + hex.EncodeToString(b)
}

