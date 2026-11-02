// Package model holds appointment-service types (Database.md: appointments, appointment_status).
package model

import "time"

// Status mirrors the appointment_status enum.
type Status string

const (
	StatusPending    Status = "PENDING"
	StatusApproved   Status = "APPROVED"
	StatusRejected   Status = "REJECTED"
	StatusCheckedIn  Status = "CHECKED_IN"
	StatusInProgress Status = "IN_PROGRESS"
	StatusCompleted  Status = "COMPLETED"
	StatusCancelled  Status = "CANCELLED"
	StatusNoShow     Status = "NO_SHOW"
)

// StageIndex maps a status to the public tracker stage
// (0 Submitted, 1 Approved, 2 Checked In, 3 In Progress, 4 Delivered).
func (s Status) StageIndex() int {
	switch s {
	case StatusApproved:
		return 1
	case StatusCheckedIn:
		return 2
	case StatusInProgress:
		return 3
	case StatusCompleted:
		return 4
	}
	return 0
}

// Appointment mirrors the appointments table plus joined department/service names.
type Appointment struct {
	ID                   string     `json:"id"`
	ReferenceNumber      string     `json:"referenceNumber"`
	CitizenID            string     `json:"citizenId"`
	CitizenName          string     `json:"citizenName"`
	CitizenPhone         string     `json:"citizenPhone"`
	CitizenEmail         *string    `json:"citizenEmail"`
	DepartmentID         string     `json:"departmentId"`
	DepartmentName       string     `json:"departmentName"`
	ServiceID            string     `json:"serviceId"`
	ServiceName          string     `json:"serviceName"`
	Date                 string     `json:"date"` // YYYY-MM-DD
	TimeSlot             string     `json:"timeSlot"`
	Status               Status     `json:"status"`
	TokenNumber          *string    `json:"tokenNumber"`
	CitizenNotes         *string    `json:"citizenNotes"`
	OfficerNotes         *string    `json:"officerNotes"`
	RejectionReason      *string    `json:"rejectionReason"`
	ResponsibleOfficerID *string    `json:"responsibleOfficerId"`
	CheckedInAt          *time.Time `json:"checkedInAt"`
	CompletedAt          *time.Time `json:"completedAt"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

// BookRequest is the body of POST /appointments.
type BookRequest struct {
	CitizenName  string `json:"citizenName"`
	CitizenPhone string `json:"citizenPhone"`
	CitizenEmail string `json:"citizenEmail"`
	DepartmentID string `json:"departmentId"`
	ServiceID    string `json:"serviceId"`
	Date         string `json:"date"`
	TimeSlot     string `json:"timeSlot"`
	CitizenNotes string `json:"citizenNotes"`
}

// StatusUpdate is the body of PATCH /appointments/{id}/status.
type StatusUpdate struct {
	Status          Status `json:"status"`
	OfficerNotes    string `json:"officerNotes"`
	RejectionReason string `json:"rejectionReason"`
}

// RescheduleRequest is the body of POST /appointments/{id}/reschedule.
type RescheduleRequest struct {
	NewDate     string `json:"newDate"`
	NewTimeSlot string `json:"newTimeSlot"`
	Reason      string `json:"reason"`
}

// TrackResult is the public tracking projection.
type TrackResult struct {
	ReferenceNumber   string  `json:"referenceNumber"`
	CitizenName       string  `json:"citizenName"`
	ServiceName       string  `json:"serviceName"`
	DepartmentName    string  `json:"departmentName"`
	Date              string  `json:"date"`
	TimeSlot          string  `json:"timeSlot"`
	Status            Status  `json:"status"`
	TokenNumber       *string `json:"tokenNumber"`
	CurrentStageIndex int     `json:"currentStageIndex"`
	OfficerNotes      *string `json:"officerNotes"`
}

// Slip is the printable appointment slip.
type Slip struct {
	Appointment       *Appointment `json:"appointment"`
	BuildingRoom      string       `json:"buildingRoom"`
	RequiredDocuments []string     `json:"requiredDocuments"`
	Instructions      []string     `json:"instructions"`
	Barcode           string       `json:"barcode"`
}

// ListFilter holds GET /appointments query params.
type ListFilter struct {
	Timeframe    string // TODAY | UPCOMING | ALL
	Status       string
	DepartmentID string
	Search       string
	Page, Limit  int
}

// Summary is GET /reports/summary.
type Summary struct {
	TotalAppointments     int `json:"totalAppointments"`
	CompletedAppointments int `json:"completedAppointments"`
	NoShowAppointments    int `json:"noShowAppointments"`
	CancelledAppointments int `json:"cancelledAppointments"`
	CompletionRate        int `json:"completionRate"`
	NoShowRate            int `json:"noShowRate"`
}
