package repository

import (
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/woreda/booking/audit-service/model"
	"github.com/woreda/booking/audit-service/utils"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = model.ErrNotFound

// notFound maps pgx.ErrNoRows to ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func newID(prefix string) string {
	return utils.GenerateID(prefix)
}
