package service

import (
	"context"
	"log/slog"
)

// Publisher emits domain events consumed by downstream handlers (e.g. audit-service).
type Publisher interface {
	Publish(ctx context.Context, eventType string, payload any)
}

// LogPublisher is a stand-in until a broker (NATS/Kafka/RabbitMQ) is chosen.
type LogPublisher struct{}

// Publish logs the event instead of sending it.
func (LogPublisher) Publish(_ context.Context, eventType string, payload any) {
	slog.Info("event published (log only)", "type", eventType, "payload", payload)
}
