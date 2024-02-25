// Package config loads service settings from the environment.
package config

import "os"

// Config holds runtime configuration.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	// KafkaBrokers (comma-separated host:port) enables event streaming; empty = events are only logged.
	KafkaBrokers string
	// CatalogGRPCAddr is department-service's gRPC catalog API (host:port).
	CatalogGRPCAddr string
}

// Load reads env vars, falling back to local-development defaults.
func Load() Config {
	return Config{
		Port:            getenv("PORT", "8084"),
		DatabaseURL:     getenv("DATABASE_URL", "postgres://woreda:woreda@localhost:5432/woreda?sslmode=disable"),
		JWTSecret:       getenv("JWT_SECRET", "dev-secret-change-me"),
		KafkaBrokers:    os.Getenv("KAFKA_BROKERS"),
		CatalogGRPCAddr: getenv("CATALOG_GRPC_ADDR", "localhost:9083"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
