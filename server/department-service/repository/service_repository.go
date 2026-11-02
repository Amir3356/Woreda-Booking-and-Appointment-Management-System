package repository

import (
	"context"

	"github.com/woreda/booking/department-service/model"
)

const selectService = `
SELECT id, department_id, name, code, COALESCE(description, ''), duration_minutes, daily_quota,
       fee_etb::float8, processing_days, required_documents, is_active, created_at, updated_at
FROM services`

func scanService(row interface{ Scan(...any) error }) (*model.Service, error) {
	var s model.Service
	err := row.Scan(&s.ID, &s.DepartmentID, &s.Name, &s.Code, &s.Description, &s.DurationMinutes, &s.DailyQuota,
		&s.FeeETB, &s.ProcessingDays, &s.RequiredDocuments, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

// ListServices returns catalog entries matching f.
func (r *Repository) ListServices(ctx context.Context, f model.ServiceFilter) ([]model.Service, error) {
	rows, err := r.db.Query(ctx, selectService+`
		WHERE ($1 = '' OR department_id = $1)
		  AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR code ILIKE '%' || $2 || '%')
		  AND ($3::boolean IS NULL OR is_active = $3)
		ORDER BY name`, f.DepartmentID, f.Search, f.IsActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Service{}
	for rows.Next() {
		s, err := scanService(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

// GetService fetches one service.
func (r *Repository) GetService(ctx context.Context, id string) (*model.Service, error) {
	return scanService(r.db.QueryRow(ctx, selectService+` WHERE id = $1`, id))
}

// CreateService inserts a service and returns its id.
func (r *Repository) CreateService(ctx context.Context, in model.ServiceInput) (string, error) {
	id := newID("srv")
	_, err := r.db.Exec(ctx, `
		INSERT INTO services (id, department_id, code, name, description, duration_minutes, daily_quota,
		                      fee_etb, processing_days, required_documents)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, in.DepartmentID, in.Code, in.Name, in.Description, in.DurationMinutes, in.DailyQuota,
		in.FeeETB, in.ProcessingDays, in.RequiredDocuments)
	return id, err
}

// UpdateService overwrites editable service fields.
func (r *Repository) UpdateService(ctx context.Context, id string, in model.ServiceInput) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE services SET department_id = $2, code = $3, name = $4, description = $5, duration_minutes = $6,
		       daily_quota = $7, fee_etb = $8, processing_days = $9, required_documents = $10
		WHERE id = $1`,
		id, in.DepartmentID, in.Code, in.Name, in.Description, in.DurationMinutes, in.DailyQuota,
		in.FeeETB, in.ProcessingDays, in.RequiredDocuments)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// ToggleServiceStatus flips is_active.
func (r *Repository) ToggleServiceStatus(ctx context.Context, id string) (bool, error) {
	var active bool
	err := r.db.QueryRow(ctx, `UPDATE services SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`, id).Scan(&active)
	return active, notFound(err)
}

// DeleteService hard-deletes a service (appointments FK RESTRICT blocks in-use services).
func (r *Repository) DeleteService(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM services WHERE id = $1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
