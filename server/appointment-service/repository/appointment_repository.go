package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/appointment-service/model"
	"github.com/woreda/booking/appointment-service/utils"
)

// Repository persists appointments.
type Repository struct{ db *pgxpool.Pool }

// New returns a Repository backed by pool.
func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

const selectAppointment = `
SELECT a.id, a.reference_number, a.citizen_id, a.citizen_name, a.citizen_phone, a.citizen_email,
       a.department_id, d.name, a.service_id, s.name, to_char(a.appointment_date, 'YYYY-MM-DD'), a.time_slot,
       a.status::text, a.token_number, a.citizen_notes, a.officer_notes, a.rejection_reason,
       a.responsible_officer_id, a.checked_in_at, a.completed_at, a.created_at, a.updated_at
FROM appointments a
JOIN departments d ON d.id = a.department_id
JOIN services s ON s.id = a.service_id`

func scan(row pgx.Row) (*model.Appointment, error) {
	var a model.Appointment
	err := row.Scan(&a.ID, &a.ReferenceNumber, &a.CitizenID, &a.CitizenName, &a.CitizenPhone, &a.CitizenEmail,
		&a.DepartmentID, &a.DepartmentName, &a.ServiceID, &a.ServiceName, &a.Date, &a.TimeSlot,
		&a.Status, &a.TokenNumber, &a.CitizenNotes, &a.OfficerNotes, &a.RejectionReason,
		&a.ResponsibleOfficerID, &a.CheckedInAt, &a.CompletedAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return &a, nil
}

func collect(rows pgx.Rows, err error) ([]model.Appointment, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Appointment{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

// reserveSlot serialises bookings for one service/date/slot with a transaction-scoped advisory
// lock (Postgres disallows FOR UPDATE with COUNT(*)) and fails with ErrSlotFull at capacity.
func reserveSlot(ctx context.Context, tx pgx.Tx, serviceID, date, slot string) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1 || '|' || $2 || '|' || $3))`,
		serviceID, date, slot); err != nil {
		return err
	}
	var booked, max int
	err := tx.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM appointments
		         WHERE service_id = $1 AND appointment_date = $2::date AND time_slot = $3
		           AND status NOT IN ('CANCELLED', 'REJECTED')),
		       COALESCE((SELECT max_parallel_slots FROM system_settings WHERE id = 'primary'), 3)`,
		serviceID, date, slot).Scan(&booked, &max)
	if err != nil {
		return err
	}
	if booked >= max {
		return ErrSlotFull
	}
	return nil
}

// Create books an appointment atomically (Database.md §5.2). DepartmentID is derived from the service.
func (r *Repository) Create(ctx context.Context, a *model.Appointment) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			SELECT s.department_id, d.name, s.name FROM services s JOIN departments d ON d.id = s.department_id
			WHERE s.id = $1 AND s.is_active AND d.is_active`, a.ServiceID,
		).Scan(&a.DepartmentID, &a.DepartmentName, &a.ServiceName)
		if err != nil {
			return notFound(err)
		}
		if err := reserveSlot(ctx, tx, a.ServiceID, a.Date, a.TimeSlot); err != nil {
			return err
		}
		a.ID = newID("apt")
		a.ReferenceNumber = utils.GenerateReferenceNumber(time.Now())
		return tx.QueryRow(ctx, `
			INSERT INTO appointments (id, reference_number, citizen_id, citizen_name, citizen_phone, citizen_email,
			       department_id, service_id, appointment_date, time_slot, status, citizen_notes)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11::appointment_status, $12)
			RETURNING created_at, updated_at`,
			a.ID, a.ReferenceNumber, a.CitizenID, a.CitizenName, a.CitizenPhone, a.CitizenEmail,
			a.DepartmentID, a.ServiceID, a.Date, a.TimeSlot, string(a.Status), a.CitizenNotes,
		).Scan(&a.CreatedAt, &a.UpdatedAt)
	})
}

// GetByID fetches one appointment.
func (r *Repository) GetByID(ctx context.Context, id string) (*model.Appointment, error) {
	return scan(r.db.QueryRow(ctx, selectAppointment+` WHERE a.id = $1`, id))
}

// Track finds the latest appointment by reference number or citizen phone.
func (r *Repository) Track(ctx context.Context, ref string) (*model.Appointment, error) {
	return scan(r.db.QueryRow(ctx, selectAppointment+`
		WHERE a.reference_number = $1 OR a.citizen_phone = $1 ORDER BY a.created_at DESC LIMIT 1`, ref))
}

// ListByCitizen returns a citizen's history for a client tab.
func (r *Repository) ListByCitizen(ctx context.Context, citizenID, tab, search string) ([]model.Appointment, error) {
	return collect(r.db.Query(ctx, selectAppointment+`
		WHERE a.citizen_id = $1
		  AND CASE $2
		        WHEN 'UPCOMING'  THEN a.appointment_date >= CURRENT_DATE AND a.status IN ('PENDING','APPROVED','CHECKED_IN','IN_PROGRESS')
		        WHEN 'COMPLETED' THEN a.status = 'COMPLETED'
		        WHEN 'CANCELLED' THEN a.status IN ('CANCELLED','REJECTED','NO_SHOW')
		        ELSE TRUE END
		  AND ($3 = '' OR a.reference_number ILIKE '%' || $3 || '%' OR s.name ILIKE '%' || $3 || '%')
		ORDER BY a.appointment_date DESC, a.created_at DESC`, citizenID, tab, search))
}

// List returns a filtered page of the registry plus the total count.
func (r *Repository) List(ctx context.Context, f model.ListFilter) ([]model.Appointment, int, error) {
	const where = `
		WHERE ($1 = '' OR a.department_id = $1)
		  AND ($2 = '' OR a.status::text = $2)
		  AND CASE $3 WHEN 'TODAY' THEN a.appointment_date = CURRENT_DATE
		              WHEN 'UPCOMING' THEN a.appointment_date > CURRENT_DATE ELSE TRUE END
		  AND ($4 = '' OR a.citizen_name ILIKE '%' || $4 || '%' OR a.reference_number ILIKE '%' || $4 || '%'
		       OR a.citizen_phone ILIKE '%' || $4 || '%')`
	args := []any{f.DepartmentID, f.Status, f.Timeframe, f.Search}
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM appointments a JOIN services s ON s.id = a.service_id`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	items, err := collect(r.db.Query(ctx, selectAppointment+where+`
		ORDER BY a.appointment_date, a.time_slot OFFSET $5 LIMIT $6`,
		append(args, (f.Page-1)*f.Limit, f.Limit)...))
	return items, total, err
}

// Review applies an officer's APPROVED/REJECTED decision to a PENDING appointment.
func (r *Repository) Review(ctx context.Context, id, officerID string, u model.StatusUpdate) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE appointments SET status = $2::appointment_status, officer_notes = NULLIF($3, ''),
		       rejection_reason = NULLIF($4, ''), responsible_officer_id = $5
		WHERE id = $1 AND status = 'PENDING'`,
		id, string(u.Status), u.OfficerNotes, u.RejectionReason, officerID)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// Reschedule moves an appointment to a new slot (capacity-checked) and resets it to APPROVED.
func (r *Repository) Reschedule(ctx context.Context, a *model.Appointment, date, slot string) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		if err := reserveSlot(ctx, tx, a.ServiceID, date, slot); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			UPDATE appointments SET appointment_date = $2::date, time_slot = $3, status = 'APPROVED'
			WHERE id = $1`, a.ID, date, slot)
		return err
	})
}

// Cancel marks an active appointment CANCELLED, freeing its slot.
func (r *Repository) Cancel(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE appointments SET status = 'CANCELLED' WHERE id = $1 AND status IN ('PENDING', 'APPROVED')`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// SlipDetails returns the department location and the service's required documents.
func (r *Repository) SlipDetails(ctx context.Context, a *model.Appointment) (string, []string, error) {
	var room string
	var docs []string
	err := r.db.QueryRow(ctx, `
		SELECT d.building_room, s.required_documents FROM services s JOIN departments d ON d.id = s.department_id
		WHERE s.id = $1`, a.ServiceID).Scan(&room, &docs)
	return room, docs, notFound(err)
}

// Summary aggregates outcomes for appointment dates in [from, to).
func (r *Repository) Summary(ctx context.Context, from, to time.Time, deptID string) (*model.Summary, error) {
	var s model.Summary
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE status = 'COMPLETED'),
		       COUNT(*) FILTER (WHERE status = 'NO_SHOW'),
		       COUNT(*) FILTER (WHERE status = 'CANCELLED')
		FROM appointments
		WHERE appointment_date >= $1 AND appointment_date < $2 AND ($3 = '' OR department_id = $3)`,
		from, to, deptID).Scan(&s.TotalAppointments, &s.CompletedAppointments, &s.NoShowAppointments, &s.CancelledAppointments)
	return &s, err
}
