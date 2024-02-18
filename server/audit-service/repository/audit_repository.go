package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/audit-service/model"
)

// Repository persists audit logs.
type Repository struct{ db *pgxpool.Pool }

// New returns a Repository backed by pool.
func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// List returns audit logs filtered by action or role, with pagination.
func (r *Repository) List(ctx context.Context, action, role string, limit, offset int) ([]model.AuditLog, int, error) {
	var conds []string
	var args []any
	idx := 1

	if action != "" {
		conds = append(conds, fmt.Sprintf("action = $%d", idx))
		args = append(args, action)
		idx++
	}
	if role != "" {
		conds = append(conds, fmt.Sprintf("user_role = $%d", idx))
		args = append(args, strings.ToUpper(role))
		idx++
	}

	where := ""
	if len(conds) > 0 {
		where = " WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM audit_logs" + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, user_name, user_role, action, entity, details, ip_address, created_at
		FROM audit_logs%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []model.AuditLog{}
	for rows.Next() {
		var l model.AuditLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.UserName, &l.UserRole, &l.Action, &l.Entity, &l.Details, &l.IPAddress, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, l)
	}
	return out, total, rows.Err()
}

// Record inserts a new audit log entry.
func (r *Repository) Record(ctx context.Context, l *model.AuditLog) error {
	if l.ID == "" {
		l.ID = newID("log")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, details, ip_address, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
		l.ID, l.UserID, l.UserName, l.UserRole, l.Action, l.Entity, l.Details, l.IPAddress)
	return err
}

