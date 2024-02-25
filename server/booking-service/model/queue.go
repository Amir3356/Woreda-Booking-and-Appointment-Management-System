package model

import "errors"

// QueueStatus mirrors the queue_status enum.
type QueueStatus string

const (
	QueueWaiting   QueueStatus = "WAITING"
	QueueServing   QueueStatus = "SERVING"
	QueueCompleted QueueStatus = "COMPLETED"
	QueueNoShow    QueueStatus = "NO_SHOW"
)

// ErrStateChanged is returned when a row no longer matches the expected status.
var ErrStateChanged = errors.New("state changed concurrently")

// CheckInAppointment is the appointment data needed to verify a check-in.
type CheckInAppointment struct {
	ID, Status, DepartmentID, DepartmentCode, CitizenName, ServiceName string
}

// CheckInRequest is the body of POST /queue/verify-checkin.
type CheckInRequest struct {
	AppointmentID     string   `json:"appointmentId"`
	VerifiedDocuments []string `json:"verifiedDocuments"`
	Notes             string   `json:"notes"`
}

// IssuedToken is what the repository returns after creating a queue token.
type IssuedToken struct {
	TokenNumber   string
	CounterNumber int
	WaitingAhead  int
}

// CheckInResult is the response of POST /queue/verify-checkin.
type CheckInResult struct {
	TokenNumber          string      `json:"tokenNumber"`
	AppointmentID        string      `json:"appointmentId"`
	CitizenName          string      `json:"citizenName"`
	ServiceName          string      `json:"serviceName"`
	CounterNumber        int         `json:"counterNumber"`
	Status               QueueStatus `json:"status"`
	EstimatedWaitMinutes int         `json:"estimatedWaitMinutes"`
}

// ServingToken is the board's "now serving" entry.
type ServingToken struct {
	ID            string `json:"id"`
	TokenNumber   string `json:"tokenNumber"`
	CitizenName   string `json:"citizenName"`
	ServiceName   string `json:"serviceName"`
	CounterNumber int    `json:"counterNumber"`
	CalledTime    string `json:"calledTime"`
}

// WaitingToken is one waiting-list entry.
type WaitingToken struct {
	ID                        string `json:"id"`
	TokenNumber               string `json:"tokenNumber"`
	CitizenName               string `json:"citizenName"`
	ServiceName               string `json:"serviceName"`
	CheckedInTime             string `json:"checkedInTime"`
	EstimatedMinutesRemaining int    `json:"estimatedMinutesRemaining"`
}

// QueueBoard is GET /queue.
type QueueBoard struct {
	NowServing  *ServingToken  `json:"nowServing"`
	WaitingList []WaitingToken `json:"waitingList"`
}

// CallNextRequest is the body of POST /queue/call-next.
type CallNextRequest struct {
	CounterNumber int `json:"counterNumber"`
}

// CallNextResult is the response of POST /queue/call-next.
type CallNextResult struct {
	AppointmentID string `json:"appointmentId"`
	CalledToken   string `json:"calledToken"`
	CitizenName   string `json:"citizenName"`
	CounterNumber int    `json:"counterNumber"`
	ChimeText     string `json:"chimeText"`
}

// FinalizeRequest is the body of PATCH /queue/{id}/status.
type FinalizeRequest struct {
	Status QueueStatus `json:"status"`
}
