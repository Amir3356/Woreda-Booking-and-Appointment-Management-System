// Package service holds schedule, availability and queue business rules.
package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/woreda/booking/booking-service/model"
)

// Repository is the persistence port this service needs (implemented by repository.Repository).
type Repository interface {
	ListSchedules(ctx context.Context) ([]model.Schedule, error)
	GetSchedule(ctx context.Context, id string) (*model.Schedule, error)
	CreateSchedule(ctx context.Context, in model.ScheduleInput) (string, error)
	ActiveSchedule(ctx context.Context, serviceID, date string) (*model.Schedule, error)
	SlotCounts(ctx context.Context, serviceID, date string) (map[string]int, error)
	MaxParallelSlots(ctx context.Context) (int, error)
	GetCheckInAppointment(ctx context.Context, id string) (*model.CheckInAppointment, error)
	IssueToken(ctx context.Context, a *model.CheckInAppointment, officerID string) (*model.IssuedToken, error)
	Board(ctx context.Context, deptID string) (*model.QueueBoard, error)
	CallNext(ctx context.Context, deptID, officerID string, counter int) (*model.CallNextResult, error)
	Finalize(ctx context.Context, id, deptID string, status model.QueueStatus) error
}

// Municipal booking grid: 30-minute slots from 08:30 to 16:30, lunch break at 12:30.
const (
	slotMinutes  = 30
	firstSlotMin = 8*60 + 30
	lastSlotMin  = 16*60 + 30
	lunchSlotMin = 12*60 + 30
)

var weekdays = []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}

// Service implements schedule and queue use cases.
type Service struct{ repo Repository }

// New builds a Service.
func New(repo Repository) *Service { return &Service{repo: repo} }

func label(s model.Schedule) model.Schedule {
	if s.Status == string(model.ScheduleActive) {
		s.Status = "Active"
	} else {
		s.Status = "Inactive"
	}
	return s
}

// ListSchedules returns schedules with client status labels.
func (s *Service) ListSchedules(ctx context.Context) ([]model.Schedule, error) {
	list, err := s.repo.ListSchedules(ctx)
	for i := range list {
		list[i] = label(list[i])
	}
	return list, err
}

// CreateSchedule validates and creates a schedule.
func (s *Service) CreateSchedule(ctx context.Context, in model.ScheduleInput) (*model.Schedule, error) {
	v := &ValidationError{}
	if in.DepartmentID == "" {
		v.add("departmentId", "Department is required.")
	}
	if len(in.WorkingDays) == 0 {
		in.WorkingDays = weekdays[:5]
	}
	for _, d := range in.WorkingDays {
		if !slices.Contains(weekdays, d) {
			v.add("workingDays", fmt.Sprintf("Unknown day %q (use Mon..Sun).", d))
		}
	}
	open, err1 := time.Parse("15:04", in.OpeningTime)
	closing, err2 := time.Parse("15:04", in.ClosingTime)
	if err1 != nil || err2 != nil || !closing.After(open) {
		v.add("closingTime", "Opening/closing must be HH:MM and closing must be after opening.")
	}
	if in.DailyCapacity <= 0 {
		v.add("dailyCapacity", "Daily capacity must be positive.")
	}
	if _, err := time.Parse(time.DateOnly, in.EffectiveStartDate); err != nil {
		v.add("effectiveStartDate", "Start date must be YYYY-MM-DD.")
	}
	if in.EffectiveEndDate != nil && *in.EffectiveEndDate < in.EffectiveStartDate {
		v.add("effectiveEndDate", "End date cannot precede start date.")
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	id, err := s.repo.CreateSchedule(ctx, in)
	if err != nil {
		return nil, err
	}
	sc, err := s.repo.GetSchedule(ctx, id)
	if err != nil {
		return nil, err
	}
	l := label(*sc)
	return &l, nil
}

// slotLabel formats minutes-since-midnight in the client format ("09:00 AM", "13:30 PM").
func slotLabel(m int) string {
	suffix := "AM"
	if m >= 12*60 {
		suffix = "PM"
	}
	return fmt.Sprintf("%02d:%02d %s", m/60, m%60, suffix)
}

func minutes(hhmm string) int {
	t, err := time.Parse("15:04", hhmm)
	if err != nil {
		return 0
	}
	return t.Hour()*60 + t.Minute()
}

// Availability computes per-slot capacity for a service on a date.
func (s *Service) Availability(ctx context.Context, serviceID, date string) (*model.Availability, error) {
	v := &ValidationError{}
	day, err := time.Parse(time.DateOnly, date)
	if err != nil {
		v.add("date", "Date must be YYYY-MM-DD.")
	}
	if serviceID == "" {
		v.add("serviceId", "serviceId is required.")
	}
	if err := v.err(); err != nil {
		return nil, err
	}
	max, err := s.repo.MaxParallelSlots(ctx)
	if err != nil {
		return nil, err
	}
	sched, err := s.repo.ActiveSchedule(ctx, serviceID, date)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return nil, err
	}
	counts, err := s.repo.SlotCounts(ctx, serviceID, date)
	if err != nil {
		return nil, err
	}
	open, closing := 0, 0
	if sched != nil && slices.Contains(sched.WorkingDays, weekdays[(int(day.Weekday())+6)%7]) {
		open, closing = minutes(sched.OpeningTime), minutes(sched.ClosingTime)
	}
	out := &model.Availability{ServiceID: serviceID, Date: date, MaxParallelSlots: max}
	for m := firstSlotMin; m <= lastSlotMin; m += slotMinutes {
		slot := model.Slot{TimeSlot: slotLabel(m), BookedCount: counts[slotLabel(m)]}
		switch {
		case m < open || m+slotMinutes > closing || m == lunchSlotMin:
			slot.Status = model.SlotUnavailable
		case slot.BookedCount >= max:
			slot.Status = model.SlotFull
		default:
			slot.Status, slot.RemainingCapacity = model.SlotAvailable, max-slot.BookedCount
		}
		out.Slots = append(out.Slots, slot)
	}
	// TODO: also enforce schedules.daily_capacity / services.daily_quota and public holidays.
	return out, nil
}
