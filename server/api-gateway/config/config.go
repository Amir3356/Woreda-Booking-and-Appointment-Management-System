// Package config loads gateway settings from the environment.
package config

import (
	"os"
	"strings"
)

// Config holds gateway runtime configuration.
type Config struct {
	Port           string
	JWTSecret      string
	AllowedOrigins []string
	Services       Services
	// RedisURL enables response caching and token revocation checks (empty = disabled).
	RedisURL string
	// KafkaBrokers (comma-separated host:port) enables the appointment event consumer.
	KafkaBrokers string
}

// Services holds upstream base URLs for each backend service.
type Services struct {
	Auth        string
	User        string
	Department  string
	Appointment string
	Booking     string
}

// Load reads configuration from env vars, falling back to local defaults.
func Load() Config {
	return Config{
		Port:           getenv("PORT", "8080"),
		JWTSecret:      getenv("JWT_SECRET", "dev-secret-change-me"),
		AllowedOrigins: strings.Split(getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"), ","),
		RedisURL:       os.Getenv("REDIS_URL"),
		KafkaBrokers:   os.Getenv("KAFKA_BROKERS"),
		Services: Services{
			Auth:        getenv("AUTH_SERVICE_URL", "http://localhost:8081"),
			User:        getenv("USER_SERVICE_URL", "http://localhost:8082"),
			Department:  getenv("DEPARTMENT_SERVICE_URL", "http://localhost:8083"),
			Appointment: getenv("APPOINTMENT_SERVICE_URL", "http://localhost:8084"),
			Booking:     getenv("BOOKING_SERVICE_URL", "http://localhost:8085"),
		},
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
