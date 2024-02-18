package utils

import (
	"net/mail"
	"regexp"
	"strings"
)

var ethiopianPhoneRegex = regexp.MustCompile(`^\+2519\d{8}$`)

// IsValidEthiopianPhone validates that phone matches the standard Ethiopian telecom format: +2519XXXXXXXX.
func IsValidEthiopianPhone(phone string) bool {
	phone = strings.TrimSpace(phone)
	return ethiopianPhoneRegex.MatchString(phone)
}

// NormalizeEthiopianPhone formats local prefixes (e.g. "0911223344" or "911223344") into "+251911223344".
func NormalizeEthiopianPhone(phone string) string {
	phone = strings.TrimSpace(phone)
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")

	if strings.HasPrefix(phone, "+251") {
		return phone
	}
	if strings.HasPrefix(phone, "09") && len(phone) == 10 {
		return "+251" + phone[1:]
	}
	if strings.HasPrefix(phone, "9") && len(phone) == 9 {
		return "+251" + phone
	}
	return phone
}

// IsValidEmail verifies if the provided email string has valid syntax.
func IsValidEmail(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" || len(email) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email
}

