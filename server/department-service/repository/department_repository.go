package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/department-service/model"
)

// Repository persists departments and services.
type Repository struct{ db *pgxpool.Pool }

// New returns a Repository backed by pool.
func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

const selectDepartment = `
SELECT d.id, d.name, d.code, COALESCE(d.description, ''), d.building_room, d.contact_phone, d.is_active,
       (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'OFFICER'),
       (SELECT COUNT(*) FROM services s WHERE s.department_id = d.id),
       d.created_at, d.updated_at
FROM departments d`

func scanDepartment(row interface{ Scan(...any) error }) (*model.Department, error) {
	var d model.Department
	err := row.Scan(&d.ID, &d.Name, &d.Code, &d.Description, &d.BuildingRoom, &d.ContactPhone, &d.IsActive,
		&d.OfficerCount, &d.ServiceCount, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return &d, nil
}

// ListDepartments returns departments, optionally filtered by is_active.
func (r *Repository) ListDepartments(ctx context.Context, isActive *bool) ([]model.Department, error) {
	rows, err := r.db.Query(ctx, selectDepartment+` WHERE ($1::boolean IS NULL OR d.is_active = $1) ORDER BY d.name`, isActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Department{}
	for rows.Next() {
		d, err := scanDepartment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

// GetDepartment fetches one department.
func (r *Repository) GetDepartment(ctx context.Context, id string) (*model.Department, error) {
	return scanDepartment(r.db.QueryRow(ctx, selectDepartment+` WHERE d.id = $1`, id))
}

// CreateDepartment inserts a department and returns its id.
func (r *Repository) CreateDepartment(ctx context.Context, in model.DepartmentInput) (string, error) {
	id := newID("dept")
	_, err := r.db.Exec(ctx, `
		INSERT INTO departments (id, code, name, description, building_room, contact_phone)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		id, in.Code, in.Name, in.Description, in.BuildingRoom, in.ContactPhone)
	return id, err
}

// UpdateDepartment overwrites editable department fields.
func (r *Repository) UpdateDepartment(ctx context.Context, id string, in model.DepartmentInput) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE departments SET code = $2, name = $3, description = $4, building_room = $5, contact_phone = $6
		WHERE id = $1`, id, in.Code, in.Name, in.Description, in.BuildingRoom, in.ContactPhone)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// ToggleDepartmentStatus flips is_active.
func (r *Repository) ToggleDepartmentStatus(ctx context.Context, id string) (bool, error) {
	var active bool
	err := r.db.QueryRow(ctx, `UPDATE departments SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`, id).Scan(&active)
	return active, notFound(err)
}

// DeleteDepartment hard-deletes; services FK is ON DELETE RESTRICT so in-use departments fail.
// TODO: decide soft vs. restricted hard delete per API.md 3.5 and map FK violations to 409.
func (r *Repository) DeleteDepartment(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM departments WHERE id = $1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
