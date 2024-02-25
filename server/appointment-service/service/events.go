package service

import (
	"context"
	"log/slog"
)

// Publisher emits appointment lifecycle events (see the events package for the Kafka implementation).
// Publishing is fire-and-forget: a broker outage must never fail a citizen's request.
type Publisher interface {
	Publish(ctx context.Context, eventType, appointmentID string, data any)
}

// LogPublisher is used when no broker is configured (KAFKA_BROKERS unset): events are only logged.
type LogPublisher struct{}

// Publish logs the event instead of sending it.
func (LogPublisher) Publish(_ context.Context, eventType, appointmentID string, _ any) {
	slog.Info("event (not streamed: KAFKA_BROKERS unset)", "type", eventType, "appointmentId", appointmentID)
}
