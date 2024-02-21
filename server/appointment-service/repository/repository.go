package repository

import (
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/woreda/booking/appointment-service/model"
	"github.com/woreda/booking/appointment-service/utils"
)

// ErrNotFound is returned when a row does not exist.
var (
	ErrNotFound = model.ErrNotFound
	ErrSlotFull = model.ErrSlotFull
)

// notFound maps pgx.ErrNoRows to ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// newID returns a short random id with the given prefix.
func newID(prefix string) string {
	return utils.GenerateID(prefix)
}
