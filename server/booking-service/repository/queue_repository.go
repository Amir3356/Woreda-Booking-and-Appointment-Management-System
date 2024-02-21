package repository

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/woreda/booking/booking-service/model"
	"github.com/woreda/booking/booking-service/utils"
)

// GetCheckInAppointment loads the appointment fields needed to verify a check-in.
func (r *Repository) GetCheckInAppointment(ctx context.Context, id string) (*model.CheckInAppointment, error) {
	var a model.CheckInAppointment
	err := r.db.QueryRow(ctx, `
		SELECT a.id, a.status::text, a.department_id, d.code, a.citizen_name, s.name
		FROM appointments a JOIN departments d ON d.id = a.department_id JOIN services s ON s.id = a.service_id
		WHERE a.id = $1`, id).Scan(&a.ID, &a.Status, &a.DepartmentID, &a.DepartmentCode, &a.CitizenName, &a.ServiceName)
	if err != nil {
		return nil, notFound(err)
	}
	return &a, nil
}

// IssueToken atomically creates today's next sequential token ({DEPT_CODE}-{SEQ:02d}) and marks
// the appointment CHECKED_IN. Returns ErrStateChanged if the appointment is no longer APPROVED.
func (r *Repository) IssueToken(ctx context.Context, a *model.CheckInAppointment, officerID string) (*model.IssuedToken, error) {
	var out model.IssuedToken
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		// Serialise token numbering per department per day.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('queue|' || $1 || '|' || CURRENT_DATE::text))`,
			a.DepartmentID); err != nil {
			return err
		}
		var seq int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(*) + 1, COALESCE((SELECT counter_number FROM users WHERE id = $2), 1),
			       (SELECT COUNT(*) FROM queue_tokens WHERE department_id = $1 AND queue_date = CURRENT_DATE AND status = 'WAITING')
			FROM queue_tokens WHERE department_id = $1 AND queue_date = CURRENT_DATE`,
			a.DepartmentID, officerID).Scan(&seq, &out.CounterNumber, &out.WaitingAhead)
		if err != nil {
			return err
		}
		out.TokenNumber = utils.GenerateQueueToken(a.DepartmentCode, seq)
		tag, err := tx.Exec(ctx, `
			UPDATE appointments SET status = 'CHECKED_IN', token_number = $2, checked_in_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND status = 'APPROVED'`, a.ID, out.TokenNumber)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return model.ErrStateChanged
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO queue_tokens (id, appointment_id, token_number, department_id, counter_number, officer_id)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			newID("q"), a.ID, out.TokenNumber, a.DepartmentID, out.CounterNumber, officerID)
		return err
	})
	return &out, err
}

// Board returns today's live queue for a department.
func (r *Repository) Board(ctx context.Context, deptID string) (*model.QueueBoard, error) {
	board := &model.QueueBoard{WaitingList: []model.WaitingToken{}}
	var s model.ServingToken
	err := r.db.QueryRow(ctx, `
		SELECT q.id, q.token_number, a.citizen_name, sv.name, q.counter_number, COALESCE(to_char(q.called_time, 'HH12:MI AM'), '')
		FROM queue_tokens q JOIN appointments a ON a.id = q.appointment_id JOIN services sv ON sv.id = a.service_id
		WHERE q.department_id = $1 AND q.queue_date = CURRENT_DATE AND q.status = 'SERVING'
		ORDER BY q.called_time DESC LIMIT 1`, deptID,
	).Scan(&s.ID, &s.TokenNumber, &s.CitizenName, &s.ServiceName, &s.CounterNumber, &s.CalledTime)
	switch {
	case err == nil:
		board.NowServing = &s
	case notFound(err) != ErrNotFound:
		return nil, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT q.id, q.token_number, a.citizen_name, sv.name, to_char(q.checked_in_time, 'HH12:MI AM'), q.estimated_minutes_remaining
		FROM queue_tokens q JOIN appointments a ON a.id = q.appointment_id JOIN services sv ON sv.id = a.service_id
		WHERE q.department_id = $1 AND q.queue_date = CURRENT_DATE AND q.status = 'WAITING'
		ORDER BY q.created_at`, deptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t model.WaitingToken
		if err := rows.Scan(&t.ID, &t.TokenNumber, &t.CitizenName, &t.ServiceName, &t.CheckedInTime, &t.EstimatedMinutesRemaining); err != nil {
			return nil, err
		}
		board.WaitingList = append(board.WaitingList, t)
	}
	return board, rows.Err()
}

// CallNext moves the oldest WAITING token to SERVING and its appointment to IN_PROGRESS.
// Returns ErrNotFound when nobody is waiting.
func (r *Repository) CallNext(ctx context.Context, deptID, officerID string, counter int) (*model.CallNextResult, error) {
	res := &model.CallNextResult{CounterNumber: counter}
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var id, apptID string
		err := tx.QueryRow(ctx, `
			SELECT q.id, q.appointment_id, q.token_number, a.citizen_name
			FROM queue_tokens q JOIN appointments a ON a.id = q.appointment_id
			WHERE q.department_id = $1 AND q.queue_date = CURRENT_DATE AND q.status = 'WAITING'
			ORDER BY q.created_at LIMIT 1 FOR UPDATE OF q SKIP LOCKED`, deptID,
		).Scan(&id, &apptID, &res.CalledToken, &res.CitizenName)
		if err != nil {
			return notFound(err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE queue_tokens SET status = 'SERVING', counter_number = $2, officer_id = $3, called_time = CURRENT_TIME
			WHERE id = $1`, id, counter, officerID); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE appointments SET status = 'IN_PROGRESS' WHERE id = $1`, apptID)
		return err
	})
	return res, err
}

// Finalize sets a token to COMPLETED/NO_SHOW and cascades the status to its appointment.
func (r *Repository) Finalize(ctx context.Context, id, deptID string, status model.QueueStatus) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var apptID string
		err := tx.QueryRow(ctx, `
			UPDATE queue_tokens SET status = $2::queue_status
			WHERE id = $1 AND ($3 = '' OR department_id = $3) AND status IN ('WAITING', 'SERVING')
			RETURNING appointment_id`, id, string(status), deptID).Scan(&apptID)
		if err != nil {
			return notFound(err)
		}
		_, err = tx.Exec(ctx, `
			UPDATE appointments SET status = $2::appointment_status,
			       completed_at = CASE WHEN $2 = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END
			WHERE id = $1`, apptID, string(status))
		return err
	})
}
