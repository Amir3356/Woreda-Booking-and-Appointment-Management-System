package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

type clientRecord struct {
	timestamps []time.Time
}

// RateLimiter tracks and limits requests per client key (IP or user).
type RateLimiter struct {
	mu      sync.Mutex
	records map[string]*clientRecord
	limit   int
	window  time.Duration
}

// NewRateLimiter instantiates a rate limiter.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		records: make(map[string]*clientRecord),
		limit:   limit,
		window:  window,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for key, cr := range rl.records {
			var valid []time.Time
			for _, t := range cr.timestamps {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.records, key)
			} else {
				cr.timestamps = valid
			}
		}
		rl.mu.Unlock()
	}
}

// Allow reports whether a request is allowed.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	cr, exists := rl.records[key]
	if !exists {
		rl.records[key] = &clientRecord{timestamps: []time.Time{now}}
		return true
	}

	var valid []time.Time
	for _, t := range cr.timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		return false
	}

	cr.timestamps = append(valid, now)
	return true
}

// RateLimit returns a route middleware guard for rate limiting.
func RateLimit(limit int, window time.Duration) func(http.HandlerFunc) http.HandlerFunc {
	rl := NewRateLimiter(limit, window)
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-Forwarded-For")
			if key == "" {
				key = r.RemoteAddr
			}
			if idx := strings.Index(key, ","); idx != -1 {
				key = strings.TrimSpace(key[:idx])
			}

			if !rl.Allow(key) {
				writeError(w, r, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please try again later.")
				return
			}
			next(w, r)
		}
	}
}

