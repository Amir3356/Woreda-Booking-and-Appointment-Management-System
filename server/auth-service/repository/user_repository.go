package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/auth-service/model"
)

// UserRepository persists users.
type UserRepository struct{ db *pgxpool.Pool }

// New returns a UserRepository backed by pool.
func New(db *pgxpool.Pool) *UserRepository { return &UserRepository{db: db} }

const selectUser = `
SELECT u.id, u.full_name, u.email, u.phone, u.password_hash, u.national_id, u.role,
       u.department_id, d.name, u.counter_number, u.address, u.is_active, u.created_at, u.updated_at
FROM users u LEFT JOIN departments d ON d.id = u.department_id`

func scanUser(row interface{ Scan(...any) error }) (*model.User, error) {
	var u model.User
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.Phone, &u.PasswordHash, &u.NationalID, &u.Role,
		&u.DepartmentID, &u.DepartmentName, &u.CounterNumber, &u.Address, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return &u, nil
}

// GetByEmail looks a user up case-insensitively (uses idx_users_email_lower).
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, selectUser+` WHERE LOWER(u.email) = LOWER($1)`, email))
}

// GetByID fetches a user by primary key.
func (r *UserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, selectUser+` WHERE u.id = $1`, id))
}

// Exists reports whether the email or national id is already registered.
func (r *UserRepository) Exists(ctx context.Context, email, nationalID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) OR national_id = $2)`,
		email, nationalID).Scan(&ok)
	return ok, err
}

// Create inserts a citizen user and fills generated fields.
func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	u.ID = newID("usr")
	return r.db.QueryRow(ctx, `
		INSERT INTO users (id, full_name, email, phone, password_hash, national_id, role, address)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING is_active, created_at, updated_at`,
		u.ID, u.FullName, u.Email, u.Phone, u.PasswordHash, u.NationalID, u.Role, u.Address,
	).Scan(&u.IsActive, &u.CreatedAt, &u.UpdatedAt)
}
