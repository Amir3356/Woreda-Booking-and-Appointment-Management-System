package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Logging logs method, path, status and latency for each request.
func Logging(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status,
				"duration", time.Since(start).String(), "requestId", r.Header.Get("X-Request-ID"))
		})
	}
}

// Recover converts panics into a 500 INTERNAL_ERROR envelope.
func Recover(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if p := recover(); p != nil {
					logger.Error("panic recovered", "path", r.URL.Path, "panic", p)
					writeError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Unhandled server exception.")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// writeError writes the API.md error envelope (middleware cannot import controller).
func writeError(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": false, "message": msg,
		"error": map[string]any{"code": code, "details": []any{}},
		"meta":  map[string]any{"timestamp": time.Now().Format(time.RFC3339), "requestId": r.Header.Get("X-Request-ID")},
	})
}
