package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

// GenerateID returns a cryptographically random, prefixed identifier (e.g. "q-1a2b3c4d5e6f").
func GenerateID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	prefix = strings.TrimSuffix(strings.TrimSpace(prefix), "-")
	if prefix == "" {
		return hex.EncodeToString(b)
	}
	return prefix + "-" + hex.EncodeToString(b)
}

// GenerateQueueToken generates a daily sequential counter queue token for a department.
// Format: {DEPT_CODE}-{SEQ:02d} (e.g. "KBL-01", "LND-04")
func GenerateQueueToken(deptCode string, dailySeq int) string {
	code := strings.ToUpper(strings.TrimSpace(deptCode))
	if code == "" {
		code = "WRD"
	}
	if dailySeq < 1 {
		dailySeq = 1
	}
	return fmt.Sprintf("%s-%02d", code, dailySeq)
}

