package controller

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

// FieldError is one entry of error.details in the API.md error envelope.
type FieldError struct {
	Field string `json:"field"`
	Issue string `json:"issue"`
}

// Pagination is the meta.pagination object for paginated lists.
type Pagination struct {
	TotalItems  int  `json:"totalItems"`
	Page        int  `json:"page"`
	Limit       int  `json:"limit"`
	TotalPages  int  `json:"totalPages"`
	HasNextPage bool `json:"hasNextPage"`
	HasPrevPage bool `json:"hasPrevPage"`
}

// NewPagination derives page metadata from a total count.
func NewPagination(total, page, limit int) Pagination {
	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	return Pagination{TotalItems: total, Page: page, Limit: limit, TotalPages: pages,
		HasNextPage: page < pages, HasPrevPage: page > 1}
}

func now() string { return time.Now().Format(time.RFC3339) }

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// OK writes the standard success envelope.
func OK(w http.ResponseWriter, status int, message string, data any) {
	writeJSON(w, status, map[string]any{
		"success": true, "message": message, "data": data,
		"meta": map[string]any{"timestamp": now(), "version": "v1"},
	})
}

// OKWithMeta writes a success envelope with extra meta keys (e.g. "pagination", "cursor").
func OKWithMeta(w http.ResponseWriter, message string, data any, meta map[string]any) {
	meta["timestamp"] = now()
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": message, "data": data, "meta": meta})
}

// Fail writes the standard error envelope.
func Fail(w http.ResponseWriter, r *http.Request, status int, code, message string, details ...FieldError) {
	if details == nil {
		details = []FieldError{}
	}
	writeJSON(w, status, map[string]any{
		"success": false, "message": message,
		"error": map[string]any{"code": code, "details": details},
		"meta":  map[string]any{"timestamp": now(), "requestId": r.Header.Get("X-Request-ID")},
	})
}

// decode reads a JSON request body (max 1 MiB).
func decode(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		return errors.New("malformed JSON body: " + err.Error())
	}
	return nil
}
