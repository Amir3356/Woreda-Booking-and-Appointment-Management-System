package utils

import (
	"time"
)

// AddisLocation is the timezone for Addis Ababa (UTC+3, EAT).
var AddisLocation *time.Location

func init() {
	loc, err := time.LoadLocation("Africa/Addis_Ababa")
	if err != nil {
		loc = time.FixedZone("EAT", 3*60*60)
	}
	AddisLocation = loc
}

// NowAddis returns the current time in the Addis Ababa timezone.
func NowAddis() time.Time {
	return time.Now().In(AddisLocation)
}

// IsWorkingDay checks if the given date falls on a municipal working day (Monday - Friday).
func IsWorkingDay(t time.Time) bool {
	wd := t.Weekday()
	return wd >= time.Monday && wd <= time.Friday
}

