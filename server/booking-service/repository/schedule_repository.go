package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/booking-service/model"
)

// Repository persists schedules and queue tokens.
type Repository struct{ db *pgxpool.Pool }

// New returns a Repository backed by pool.
func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

const selectSchedule = `
SELECT sc.id, d.name, sc.department_id, s.name, sc.service_id, sc.working_days,
       to_char(sc.opening_time, 'HH24:MI'), to_char(sc.closing_time, 'HH24:MI'), sc.daily_capacity,
       to_char(sc.effective_start_date, 'YYYY-MM-DD'), to_char(sc.effective_end_date, 'YYYY-MM-DD'), sc.status::text
FROM schedules sc
JOIN departments d ON d.id = sc.department_id
LEFT JOIN services s ON s.id = sc.service_id`

func scanSchedule(row pgx.Row) (*model.Schedule, error) {
	var s model.Schedule
	err := row.Scan(&s.ID, &s.Department, &s.DepartmentID, &s.Service, &s.ServiceID, &s.WorkingDays,
		&s.OpeningTime, &s.ClosingTime, &s.DailyCapacity, &s.EffectiveStartDate, &s.EffectiveEndDate, &s.Status)
	if err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

// ListSchedules returns all operating schedules.
func (r *Repository) ListSchedules(ctx context.Context) ([]model.Schedule, error) {
	rows, err := r.db.Query(ctx, selectSchedule+` ORDER BY d.name, sc.effective_start_date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Schedule{}
	for rows.Next() {
		s, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

// GetSchedule fetches one schedule.
func (r *Repository) GetSchedule(ctx context.Context, id string) (*model.Schedule, error) {
	return scanSchedule(r.db.QueryRow(ctx, selectSchedule+` WHERE sc.id = $1`, id))
}

// CreateSchedule inserts a schedule and returns its id.
func (r *Repository) CreateSchedule(ctx context.Context, in model.ScheduleInput) (string, error) {
	id := newID("SCH")
	_, err := r.db.Exec(ctx, `
		INSERT INTO schedules (id, department_id, service_id, working_days, opening_time, closing_time,
		                       daily_capacity, effective_start_date, effective_end_date)
		VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, $8::date, $9::date)`,
		id, in.DepartmentID, in.ServiceID, in.WorkingDays, in.OpeningTime, in.ClosingTime,
		in.DailyCapacity, in.EffectiveStartDate, in.EffectiveEndDate)
	return id, err
}

// ActiveSchedule finds the schedule in force for a service on date, preferring a
// service-specific schedule over a department-wide one (service_id IS NULL).
func (r *Repository) ActiveSchedule(ctx context.Context, serviceID, date string) (*model.Schedule, error) {
	return scanSchedule(r.db.QueryRow(ctx, selectSchedule+`
		WHERE sc.status = 'ACTIVE'
		  AND (sc.service_id = $1 OR (sc.service_id IS NULL
		       AND sc.department_id = (SELECT department_id FROM services WHERE id = $1)))
		  AND sc.effective_start_date <= $2::date
		  AND (sc.effective_end_date IS NULL OR sc.effective_end_date >= $2::date)
		ORDER BY sc.service_id NULLS LAST LIMIT 1`, serviceID, date))
}

// SlotCounts returns active bookings per time slot for a service on date.
func (r *Repository) SlotCounts(ctx context.Context, serviceID, date string) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `
		SELECT time_slot, COUNT(*) FROM appointments
		WHERE service_id = $1 AND appointment_date = $2::date AND status NOT IN ('CANCELLED', 'REJECTED')
		GROUP BY time_slot`, serviceID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var slot string
		var n int
		if err := rows.Scan(&slot, &n); err != nil {
			return nil, err
		}
		out[slot] = n
	}
	return out, rows.Err()
}

// MaxParallelSlots reads system_settings.max_parallel_slots (default 3).
func (r *Repository) MaxParallelSlots(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE((SELECT max_parallel_slots FROM system_settings WHERE id = 'primary'), 3)`).Scan(&n)
	return n, err
}
