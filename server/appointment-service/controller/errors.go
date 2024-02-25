package controller

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/woreda/booking/appointment-service/service"
)

// fail translates service errors into API.md error envelopes.
func fail(w http.ResponseWriter, r *http.Request, err error) {
	var ve *service.ValidationError
	switch {
	case errors.As(err, &ve):
		details := make([]FieldError, 0, len(ve.Issues))
		for _, i := range ve.Issues {
			details = append(details, FieldError{Field: i.Field, Issue: i.Issue})
		}
		Fail(w, r, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Validation failed for the submitted fields.", details...)
	case errors.Is(err, service.ErrUnavailable):
		slog.Warn("dependency unavailable", "path", r.URL.Path, "err", err)
		Fail(w, r, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "A required service is temporarily unavailable. Please try again shortly.")
	case errors.Is(err, service.ErrNotFound):
		Fail(w, r, http.StatusNotFound, "NOT_FOUND", "Requested entity does not exist.")
	case errors.Is(err, service.ErrSlotFull):
		Fail(w, r, http.StatusConflict, "SLOT_FULL", "Desired time slot capacity reached maximum parallel limit.")
	case errors.Is(err, service.ErrConflict):
		Fail(w, r, http.StatusConflict, "CONFLICT", err.Error())
	case errors.Is(err, service.ErrUnauthorized):
		Fail(w, r, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
	case errors.Is(err, service.ErrForbidden):
		Fail(w, r, http.StatusForbidden, "FORBIDDEN", "Insufficient role permissions.")
	case errors.Is(err, service.ErrNotImplemented):
		Fail(w, r, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Endpoint not implemented yet.")
	default:
		slog.Error("unhandled error", "path", r.URL.Path, "err", err)
		Fail(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Unhandled server exception.")
	}
}

// badRequest writes a 400 for malformed input.
func badRequest(w http.ResponseWriter, r *http.Request, err error) {
	Fail(w, r, http.StatusBadRequest, "BAD_REQUEST", err.Error())
}
