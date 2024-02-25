// Package events streams appointment lifecycle events to Kafka.
//
// Every event goes to TopicAppointments, keyed by appointment ID so all events of one appointment
// land on the same partition and are consumed in order. The same envelope is produced by
// booking-service (desk/queue events); keep the two copies of this file in sync.
package events

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

// TopicAppointments carries every appointment lifecycle event.
const TopicAppointments = "woreda.appointments"

// Event is the JSON envelope of every message on TopicAppointments.
type Event struct {
	ID            string    `json:"id"`            // unique per event, for consumer de-duplication
	Type          string    `json:"type"`          // e.g. "appointment.booked"
	Source        string    `json:"source"`        // producing service
	OccurredAt    time.Time `json:"occurredAt"`    // UTC
	AppointmentID string    `json:"appointmentId"` // also the message key
	Data          any       `json:"data,omitempty"`
}

// KafkaPublisher writes events asynchronously: Publish returns immediately and delivery errors
// are logged, so a slow or unavailable broker never delays an HTTP request.
type KafkaPublisher struct {
	w      *kafka.Writer
	source string
	logger *slog.Logger
}

// NewKafkaPublisher builds a publisher for brokers (comma-separated host:port list).
func NewKafkaPublisher(brokers, source string, logger *slog.Logger) *KafkaPublisher {
	p := &KafkaPublisher{source: source, logger: logger}
	p.w = &kafka.Writer{
		Addr:         kafka.TCP(strings.Split(brokers, ",")...),
		Topic:        TopicAppointments,
		Balancer:     &kafka.Hash{}, // same key -> same partition -> ordered per appointment
		RequiredAcks: kafka.RequireAll,
		BatchTimeout: 20 * time.Millisecond,
		WriteTimeout: 10 * time.Second,
		Async:        true,
		Completion: func(msgs []kafka.Message, err error) {
			if err != nil {
				for _, m := range msgs {
					logger.Error("event not delivered to kafka", "key", string(m.Key), "err", err)
				}
			}
		},
	}
	return p
}

// Publish queues one event for delivery.
func (p *KafkaPublisher) Publish(ctx context.Context, eventType, appointmentID string, data any) {
	ev := Event{
		ID: newID(), Type: eventType, Source: p.source,
		OccurredAt: time.Now().UTC(), AppointmentID: appointmentID, Data: data,
	}
	value, err := json.Marshal(ev)
	if err != nil {
		p.logger.Error("encode event", "type", eventType, "err", err)
		return
	}
	// The request context may end before the async write; it is not used for delivery.
	if err := p.w.WriteMessages(context.WithoutCancel(ctx), kafka.Message{
		Key: []byte(appointmentID), Value: value,
		Headers: []kafka.Header{{Key: "type", Value: []byte(eventType)}},
	}); err != nil {
		p.logger.Error("queue event", "type", eventType, "err", err)
	}
}

// Close flushes pending events; call it on shutdown.
func (p *KafkaPublisher) Close() error { return p.w.Close() }

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
