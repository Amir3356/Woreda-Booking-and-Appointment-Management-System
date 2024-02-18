package utils

import (
	"strings"
)

// ValidTimeSlots is the canonical set of 15 municipal 30-minute time slots (08:30 - 16:30, excluding 12:30-13:30 lunch).
var ValidTimeSlots = []string{
	"08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM",
	"01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
}

// IsValidTimeSlot verifies that slot is one of the approved municipal appointment slots.
func IsValidTimeSlot(slot string) bool {
	slot = strings.TrimSpace(slot)
	for _, s := range ValidTimeSlots {
		if strings.EqualFold(s, slot) {
			return true
		}
	}
	return false
}

