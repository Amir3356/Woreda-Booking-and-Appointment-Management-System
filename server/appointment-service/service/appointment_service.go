// Package service holds appointment business rules.
package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/woreda/booking/appointment-service/model"
)

var (
	ethiopianPhone = regexp.MustCompile(`^\+2519\d{8}$`)
	// Client slot format, e.g. "09:00 AM", "13:30 PM" (24h hour + AM/PM suffix as in the UI).
	timeSlot = regexp.MustCompile(`^\d{2}:\d{2} (AM|PM)$`)
)

// Repository is the persistence port this service needs (implemented by repository.Repository).
type Repository interface {
	Create(ctx context.Context, a *model.Appointment) error
	GetByID(ctx context.Context, id string) (*model.Appointment, error)
	Track(ctx context.Context, ref string) (*model.Appointment, error)
	ListByCitizen(ctx context.Context, citizenID, tab, search string) ([]model.Appointment, error)
	List(ctx context.Context, f model.ListFilter) ([]model.Appointment, int, error)
	Review(ctx context.Context, id, officerID string, u model.StatusUpdate) error
	Reschedule(ctx context.Context, a *model.Appointment, date, slot string) error
	Cancel(ctx context.Context, id string) error
	SlipDetails(ctx context.Context, a *model.Appointment) (string, []string, error)
	Summary(ctx context.Context, from, to time.Time, deptID string) (*model.Summary, error)
}

// Service implements appointment use cases.
type Service struct {
	repo   Repository
	events Publisher
}

// New builds a Service.
func New(repo Repository, events Publisher) *Service {
	return &Service{repo: repo, events: events}
}

func validDate(s string) bool { _, err := time.Parse(time.DateOnly, s); return err == nil }

func optional(s string) *string {
	if s = strings.TrimSpace(s); s == "" {
		return nil
	}
	return &s
}

// Book validates and books an appointment for the caller.
func (s *Service) Book(ctx context.Context, caller model.Caller, req model.BookRequest) (*model.Appointment, error) {
	// appointments.citizen_id is NOT NULL REFERENCES users, so a signed-in citizen is required.
	// TODO: support anonymous public booking (e.g. guest user rows) if the product needs it.
	if !caller.Authenticated() {
		return nil, fmt.Errorf("%w: sign in to book an appointment", ErrUnauthorized)
	}
	v := &ValidationError{}
	if len(strings.TrimSpace(req.CitizenName)) < 3 {
		v.add("citizenName", "Citizen name is required (min 3 characters).")
	}
	if !ethiopianPhone.MatchString(req.CitizenPhone) {
		v.add("citizenPhone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).")
	}
	if req.ServiceID == "" {
		v.add("serviceId", "Service is required.")
	}
	if !validDate(req.Date) {
		v.add("date", "Date must be YYYY-MM-DD.")
	} else if req.Date < time.Now().Format(time.DateOnly) {
		v.add("date", "Date cannot be in the past.")
	}
	if !timeSlot.MatchString(req.TimeSlot) {
		v.add("timeSlot", `Time slot must look like "09:00 AM".`)
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	a := &model.Appointment{
		CitizenID: caller.UserID, CitizenName: strings.TrimSpace(req.CitizenName), CitizenPhone: req.CitizenPhone,
		CitizenEmail: optional(req.CitizenEmail), ServiceID: req.ServiceID, Date: req.Date, TimeSlot: req.TimeSlot,
		Status: model.StatusPending, CitizenNotes: optional(req.CitizenNotes),
	}
	// TODO: honour system_settings.auto_approve_bookings and advance_booking_days.
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, err
	}
	s.events.Publish(ctx, "appointment.booked", a)
	return a, nil
}

// Track looks up an appointment by reference number or phone.
func (s *Service) Track(ctx context.Context, ref string) (*model.TrackResult, error) {
	if strings.TrimSpace(ref) == "" {
		v := &ValidationError{}
		v.add("ref", "Reference number or phone is required.")
		return nil, v
	}
	a, err := s.repo.Track(ctx, strings.TrimSpace(ref))
	if err != nil {
		return nil, err
	}
	return &model.TrackResult{
		ReferenceNumber: a.ReferenceNumber, CitizenName: a.CitizenName, ServiceName: a.ServiceName,
		DepartmentName: a.DepartmentName, Date: a.Date, TimeSlot: a.TimeSlot, Status: a.Status,
		TokenNumber: a.TokenNumber, CurrentStageIndex: a.Status.StageIndex(), OfficerNotes: a.OfficerNotes,
	}, nil
}

// Mine returns the caller's own appointments.
func (s *Service) Mine(ctx context.Context, caller model.Caller, tab, search string) ([]model.Appointment, error) {
	return s.repo.ListByCitizen(ctx, caller.UserID, strings.ToUpper(tab), strings.TrimSpace(search))
}

// List returns the registry; officers are restricted to their own department.
func (s *Service) List(ctx context.Context, caller model.Caller, f model.ListFilter) ([]model.Appointment, int, error) {
	if caller.Role == "OFFICER" {
		f.DepartmentID = caller.DepartmentID
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 200 {
		f.Limit = 20
	}
	f.Timeframe, f.Status = strings.ToUpper(f.Timeframe), strings.ToUpper(f.Status)
	return s.repo.List(ctx, f)
}

// load fetches an appointment and enforces ownership/department scoping.
func (s *Service) load(ctx context.Context, caller model.Caller, id string) (*model.Appointment, error) {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	switch caller.Role {
	case "CITIZEN":
		if a.CitizenID != caller.UserID {
			return nil, ErrForbidden
		}
	case "OFFICER":
		if a.DepartmentID != caller.DepartmentID {
			return nil, ErrForbidden
		}
	}
	return a, nil
}

// UpdateStatus approves or rejects a pending appointment.
func (s *Service) UpdateStatus(ctx context.Context, caller model.Caller, id string, u model.StatusUpdate) (*model.Appointment, error) {
	v := &ValidationError{}
	if u.Status != model.StatusApproved && u.Status != model.StatusRejected {
		v.add("status", "Status must be APPROVED or REJECTED.")
	}
	if u.Status == model.StatusRejected && strings.TrimSpace(u.RejectionReason) == "" {
		v.add("rejectionReason", "A rejection reason is required.")
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	if _, err := s.load(ctx, caller, id); err != nil {
		return nil, err
	}
	if err := s.repo.Review(ctx, id, caller.UserID, u); err != nil {
		return nil, fmt.Errorf("%w: appointment is not pending review", ErrConflict)
	}
	a, err := s.repo.GetByID(ctx, id)
	if err == nil {
		s.events.Publish(ctx, "appointment.status_"+strings.ToLower(string(u.Status)), a)
	}
	return a, err
}

// Reschedule moves an appointment to a new date/slot.
func (s *Service) Reschedule(ctx context.Context, caller model.Caller, id string, req model.RescheduleRequest) (*model.Appointment, error) {
	v := &ValidationError{}
	if !validDate(req.NewDate) {
		v.add("newDate", "Date must be YYYY-MM-DD.")
	}
	if !timeSlot.MatchString(req.NewTimeSlot) {
		v.add("newTimeSlot", `Time slot must look like "09:00 AM".`)
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	a, err := s.load(ctx, caller, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Reschedule(ctx, a, req.NewDate, req.NewTimeSlot); err != nil {
		return nil, err
	}
	s.events.Publish(ctx, "appointment.rescheduled", map[string]string{"id": id, "reason": req.Reason})
	return s.repo.GetByID(ctx, id)
}

// Cancel cancels an active appointment.
// TODO: enforce system_settings.cancellation_cutoff_hours.
func (s *Service) Cancel(ctx context.Context, caller model.Caller, id string) error {
	if _, err := s.load(ctx, caller, id); err != nil {
		return err
	}
	if err := s.repo.Cancel(ctx, id); err != nil {
		return fmt.Errorf("%w: only pending or approved appointments can be cancelled", ErrConflict)
	}
	s.events.Publish(ctx, "appointment.cancelled", map[string]string{"id": id})
	return nil
}

// Slip builds printable slip data.
func (s *Service) Slip(ctx context.Context, id string) (*model.Slip, error) {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	room, docs, err := s.repo.SlipDetails(ctx, a)
	if err != nil {
		return nil, err
	}
	return &model.Slip{
		Appointment: a, BuildingRoom: room, RequiredDocuments: docs, Barcode: a.ReferenceNumber,
		Instructions: []string{
			"Arrive 15 minutes before your time slot.",
			"Bring all original required documents.",
			"Present this slip at the reception desk for check-in.",
		},
	}, nil
}

// Summary computes report metrics for a period (TODAY | THIS_WEEK | THIS_MONTH).
func (s *Service) Summary(ctx context.Context, caller model.Caller, period, deptID string) (*model.Summary, error) {
	if caller.Role == "OFFICER" {
		deptID = caller.DepartmentID
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	var from, to time.Time
	switch strings.ToUpper(period) {
	case "TODAY":
		from, to = today, today.AddDate(0, 0, 1)
	case "THIS_WEEK":
		from = today.AddDate(0, 0, -((int(today.Weekday()) + 6) % 7)) // Monday
		to = from.AddDate(0, 0, 7)
	default: // THIS_MONTH
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		to = from.AddDate(0, 1, 0)
	}
	sum, err := s.repo.Summary(ctx, from, to, deptID)
	if err != nil {
		return nil, err
	}
	if sum.TotalAppointments > 0 {
		sum.CompletionRate = sum.CompletedAppointments * 100 / sum.TotalAppointments
		sum.NoShowRate = sum.NoShowAppointments * 100 / sum.TotalAppointments
	}
	return sum, nil
}
