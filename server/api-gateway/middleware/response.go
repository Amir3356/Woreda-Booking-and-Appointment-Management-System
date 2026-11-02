package middleware

import (
	"encoding/json"
	"net/http"
	"time"
)

// WriteError writes the API.md standard error envelope.
func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": false,
		"message": message,
		"error":   map[string]any{"code": code, "details": []any{}},
		"meta": map[string]any{
			"timestamp": time.Now().Format(time.RFC3339),
			"requestId": r.Header.Get(RequestIDHeader),
		},
	})
}
