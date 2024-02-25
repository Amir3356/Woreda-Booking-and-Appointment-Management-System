package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/woreda/booking/booking-service/model"
)

// avgServiceMinutes is the rough per-citizen wait estimate.
const avgServiceMinutes = 15

// CheckIn verifies an approved appointment at the desk and issues a queue token.
func (s *Service) CheckIn(ctx context.Context, officer model.Caller, req model.CheckInRequest) (*model.CheckInResult, error) {
	if req.AppointmentID == "" {
		v := &ValidationError{}
		v.add("appointmentId", "Appointment id is required.")
		return nil, v
	}
	a, err := s.repo.GetCheckInAppointment(ctx, req.AppointmentID)
	if err != nil {
		return nil, err
	}
	if officer.DepartmentID != "" && a.DepartmentID != officer.DepartmentID {
		return nil, ErrForbidden
	}
	if a.Status != "APPROVED" {
		return nil, fmt.Errorf("%w: only APPROVED appointments can be checked in (current: %s)", ErrConflict, a.Status)
	}
	// TODO: persist req.VerifiedDocuments / req.Notes (e.g. officer_notes or an audit event).
	tok, err := s.repo.IssueToken(ctx, a, officer.UserID)
	if errors.Is(err, model.ErrStateChanged) {
		return nil, fmt.Errorf("%w: appointment status changed, reload and retry", ErrConflict)
	}
	if err != nil {
		return nil, err
	}
	s.events.Publish(ctx, "appointment.checked_in", a.ID, map[string]any{
		"tokenNumber": tok.TokenNumber, "counterNumber": tok.CounterNumber,
		"departmentId": a.DepartmentID, "officerId": officer.UserID,
	})
	return &model.CheckInResult{
		TokenNumber: tok.TokenNumber, AppointmentID: a.ID, CitizenName: a.CitizenName, ServiceName: a.ServiceName,
		CounterNumber: tok.CounterNumber, Status: model.QueueWaiting,
		EstimatedWaitMinutes: (tok.WaitingAhead + 1) * avgServiceMinutes,
	}, nil
}

// Board returns the live queue; officers only see their own department.
func (s *Service) Board(ctx context.Context, officer model.Caller, deptID string) (*model.QueueBoard, error) {
	if officer.DepartmentID != "" {
		deptID = officer.DepartmentID
	}
	if deptID == "" {
		v := &ValidationError{}
		v.add("departmentId", "Department is required.")
		return nil, v
	}
	return s.repo.Board(ctx, deptID)
}

// CallNext calls the next waiting citizen to the officer's counter.
func (s *Service) CallNext(ctx context.Context, officer model.Caller, req model.CallNextRequest) (*model.CallNextResult, error) {
	if req.CounterNumber <= 0 {
		v := &ValidationError{}
		v.add("counterNumber", "Counter number must be positive.")
		return nil, v
	}
	res, err := s.repo.CallNext(ctx, officer.DepartmentID, officer.UserID, req.CounterNumber)
	if errors.Is(err, model.ErrNotFound) {
		return nil, fmt.Errorf("%w: no citizens are waiting", ErrConflict)
	}
	if err != nil {
		return nil, err
	}
	s.events.Publish(ctx, "appointment.in_progress", res.AppointmentID, map[string]any{
		"tokenNumber": res.CalledToken, "counterNumber": res.CounterNumber, "officerId": officer.UserID,
	})
	res.ChimeText = fmt.Sprintf("Chime: Token %s please proceed to Counter Desk #%d", res.CalledToken, res.CounterNumber)
	return res, nil
}

// Finalize closes a token as COMPLETED or NO_SHOW.
func (s *Service) Finalize(ctx context.Context, officer model.Caller, id string, req model.FinalizeRequest) error {
	if req.Status != model.QueueCompleted && req.Status != model.QueueNoShow {
		v := &ValidationError{}
		v.add("status", "Status must be COMPLETED or NO_SHOW.")
		return v
	}
	apptID, err := s.repo.Finalize(ctx, id, officer.DepartmentID, req.Status)
	if err != nil {
		return err
	}
	s.events.Publish(ctx, "appointment."+strings.ToLower(string(req.Status)), apptID, map[string]any{
		"queueTokenId": id, "officerId": officer.UserID,
	})
	return nil
}
