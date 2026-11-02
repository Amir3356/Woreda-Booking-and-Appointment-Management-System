package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// GenerateID returns a cryptographically random, prefixed identifier (e.g. "apt-1a2b3c4d5e6f").
func GenerateID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	prefix = strings.TrimSuffix(strings.TrimSpace(prefix), "-")
	if prefix == "" {
		return hex.EncodeToString(b)
	}
	return prefix + "-" + hex.EncodeToString(b)
}

// GenerateReferenceNumber generates a standard Woreda booking reference number:
// Format: WRD-YYYYMMDD-XXXX (e.g. "WRD-20261102-4821")
func GenerateReferenceNumber(t time.Time) string {
	datePart := t.Format("20060102")
	n, err := rand.Int(rand.Reader, big.NewInt(9000))
	randPart := 1000
	if err == nil {
		randPart = int(n.Int64()) + 1000
	}
	return fmt.Sprintf("WRD-%s-%04d", datePart, randPart)
}

