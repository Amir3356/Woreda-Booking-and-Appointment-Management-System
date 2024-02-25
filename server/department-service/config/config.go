// Package config loads service settings from the environment.
package config

import "os"

// Config holds runtime configuration.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	// GRPCPort serves the internal catalog API to other services (never exposed publicly).
	GRPCPort string
	// KafkaBrokers (comma-separated host:port) enables catalog change events; empty = off.
	KafkaBrokers string
}

// Load reads env vars, falling back to local-development defaults.
func Load() Config {
	return Config{
		Port:         getenv("PORT", "8083"),
		DatabaseURL:  getenv("DATABASE_URL", "postgres://woreda:woreda@localhost:5432/woreda?sslmode=disable"),
		JWTSecret:    getenv("JWT_SECRET", "dev-secret-change-me"),
		GRPCPort:     getenv("GRPC_PORT", "9083"),
		KafkaBrokers: os.Getenv("KAFKA_BROKERS"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
