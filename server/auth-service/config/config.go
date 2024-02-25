// Package config loads service settings from the environment.
package config

import "os"

// Config holds runtime configuration.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	RedisURL    string // empty disables logout revocation and login lockout
}

// Load reads env vars, falling back to local-development defaults.
func Load() Config {
	return Config{
		Port:        getenv("PORT", "8081"),
		DatabaseURL: getenv("DATABASE_URL", "postgres://woreda:woreda@localhost:5432/woreda?sslmode=disable"),
		JWTSecret:   getenv("JWT_SECRET", "dev-secret-change-me"),
		RedisURL:    os.Getenv("REDIS_URL"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
