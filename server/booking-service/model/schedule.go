// Package model holds booking-service types (Database.md: schedules, queue_tokens, schedule_status, queue_status).
package model

// ScheduleStatus mirrors the schedule_status enum.
type ScheduleStatus string

const (
	ScheduleActive   ScheduleStatus = "ACTIVE"
	ScheduleInactive ScheduleStatus = "INACTIVE"
)

// Schedule mirrors the schedules table plus joined names.
type Schedule struct {
	ID                 string   `json:"id"`
	Department         string   `json:"department"`
	DepartmentID       string   `json:"departmentId"`
	Service            *string  `json:"service"`
	ServiceID          *string  `json:"serviceId"`
	WorkingDays        []string `json:"workingDays"`
	OpeningTime        string   `json:"openingTime"` // HH:MM
	ClosingTime        string   `json:"closingTime"`
	DailyCapacity      int      `json:"dailyCapacity"`
	EffectiveStartDate string   `json:"effectiveStartDate"`
	EffectiveEndDate   *string  `json:"effectiveEndDate"`
	Status             string   `json:"status"` // client label: "Active" | "Inactive"
}

// ScheduleInput is the body of POST /schedules.
type ScheduleInput struct {
	DepartmentID       string   `json:"departmentId"`
	ServiceID          *string  `json:"serviceId"`
	WorkingDays        []string `json:"workingDays"`
	OpeningTime        string   `json:"openingTime"`
	ClosingTime        string   `json:"closingTime"`
	DailyCapacity      int      `json:"dailyCapacity"`
	EffectiveStartDate string   `json:"effectiveStartDate"`
	EffectiveEndDate   *string  `json:"effectiveEndDate"`
}

// SlotStatus is the Book Appointment availability indicator.
type SlotStatus string

const (
	SlotAvailable   SlotStatus = "Available"
	SlotFull        SlotStatus = "Full"
	SlotUnavailable SlotStatus = "Unavailable"
)

// Slot is one 30-minute interval in an availability response.
type Slot struct {
	TimeSlot          string     `json:"timeSlot"`
	BookedCount       int        `json:"bookedCount"`
	RemainingCapacity int        `json:"remainingCapacity"`
	Status            SlotStatus `json:"status"`
}

// Availability is GET /schedules/availability.
type Availability struct {
	ServiceID        string `json:"serviceId"`
	Date             string `json:"date"`
	MaxParallelSlots int    `json:"maxParallelSlots"`
	Slots            []Slot `json:"slots"`
}
