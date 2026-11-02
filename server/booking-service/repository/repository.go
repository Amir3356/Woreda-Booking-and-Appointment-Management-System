package repository

import (
	"crypto/rand"
	"encoding/hex"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/woreda/booking/booking-service/model"
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

// newID returns a short random id with the given prefix, e.g. "apt-1a2b3c4d5e6f".
// TODO: switch to UUIDv7 per Database.md once a generator is chosen.
func newID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}
