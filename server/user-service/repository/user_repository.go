package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/user-service/model"
)

// Repository persists users and system settings.
type Repository struct{ db *pgxpool.Pool }

// New returns a Repository backed by pool.
func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// GetProfile loads a citizen's profile.
func (r *Repository) GetProfile(ctx context.Context, userID string) (*model.CitizenProfile, error) {
	var p model.CitizenProfile
	err := r.db.QueryRow(ctx, `
		SELECT full_name, phone, email, national_id, COALESCE(address, '')
		FROM users WHERE id = $1 AND role = 'CITIZEN'`, userID,
	).Scan(&p.FullName, &p.Phone, &p.Email, &p.NationalID, &p.Address)
	if err != nil {
		return nil, notFound(err)
	}
	return &p, nil
}

// UpdateProfile overwrites a citizen's profile fields.
func (r *Repository) UpdateProfile(ctx context.Context, userID string, p model.CitizenProfile) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users SET full_name = $2, phone = $3, email = $4, national_id = $5, address = $6
		WHERE id = $1 AND role = 'CITIZEN'`,
		userID, p.FullName, p.Phone, p.Email, p.NationalID, p.Address)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// ListStaff returns OFFICER/ADMIN accounts using offset cursor pagination.
func (r *Repository) ListStaff(ctx context.Context, search string, offset, limit int) ([]model.StaffAccount, int, error) {
	const where = `WHERE u.role <> 'CITIZEN' AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')`
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users u `+where, search).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT u.id, u.full_name, u.email, u.role, u.department_id, d.name, u.is_active
		FROM users u LEFT JOIN departments d ON d.id = u.department_id `+where+`
		ORDER BY u.created_at DESC OFFSET $2 LIMIT $3`, search, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []model.StaffAccount{}
	for rows.Next() {
		var a model.StaffAccount
		var role model.Role
		if err := rows.Scan(&a.ID, &a.FullName, &a.Email, &role, &a.DepartmentID, &a.DepartmentName, &a.IsActive); err != nil {
			return nil, 0, err
		}
		a.Role = model.RoleLabel(role)
		out = append(out, a)
	}
	return out, total, rows.Err()
}

// CreateStaff inserts an OFFICER or ADMIN account.
func (r *Repository) CreateStaff(ctx context.Context, fullName, email, hash string, role model.Role, deptID *string) (string, error) {
	id := newID("usr")
	_, err := r.db.Exec(ctx, `
		INSERT INTO users (id, full_name, email, phone, password_hash, national_id, role, department_id)
		VALUES ($1, $2, $3, '', $4, $5, $6, $7)`,
		id, fullName, email, hash, "ET-EMP-"+id[4:], role, deptID)
	return id, err
}

// ToggleStaffStatus flips is_active and returns the new value.
func (r *Repository) ToggleStaffStatus(ctx context.Context, id string) (bool, error) {
	var active bool
	err := r.db.QueryRow(ctx,
		`UPDATE users SET is_active = NOT is_active WHERE id = $1 AND role <> 'CITIZEN' RETURNING is_active`, id,
	).Scan(&active)
	return active, notFound(err)
}

// DeleteStaff removes a staff account.
func (r *Repository) DeleteStaff(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM users WHERE id = $1 AND role <> 'CITIZEN'`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
