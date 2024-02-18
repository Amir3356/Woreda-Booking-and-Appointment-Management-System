package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// clientLimit tracks request timestamps for a client.
type clientLimit struct {
	timestamps []time.Time
}

// RateLimiter implements a sliding-window rate limiter per client IP.
type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientLimit
	limit   int
	window  time.Duration
}

// NewRateLimiter creates a RateLimiter with limit requests per window duration.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*clientLimit),
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
		for ip, cl := range rl.clients {
			var valid []time.Time
			for _, t := range cl.timestamps {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.clients, ip)
			} else {
				cl.timestamps = valid
			}
		}
		rl.mu.Unlock()
	}
}

// Allow reports whether a request from ip is permitted.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	cl, exists := rl.clients[ip]
	if !exists {
		rl.clients[ip] = &clientLimit{timestamps: []time.Time{now}}
		return true
	}

	var valid []time.Time
	for _, t := range cl.timestamps {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		return false
	}

	cl.timestamps = append(valid, now)
	return true
}

// RateLimit returns a middleware that limits requests to limit per window.
func RateLimit(limit int, window time.Duration) Middleware {
	rl := NewRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
			if idx := strings.Index(ip, ","); idx != -1 {
				ip = strings.TrimSpace(ip[:idx])
			}

			if !rl.Allow(ip) {
				WriteError(w, r, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Too many requests. Please slow down and try again later.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
