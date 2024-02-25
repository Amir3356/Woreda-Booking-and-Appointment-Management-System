// Package events streams catalog changes (departments and services) to Kafka.
//
// Every event goes to TopicCatalog, keyed by the changed entity's ID. The api-gateway consumes it
// to refresh its cache and to tell open browser pages (WebSocket) that the catalog changed.
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

// TopicCatalog carries every catalog change.
const TopicCatalog = "woreda.catalog"

// Event is the JSON envelope of every message on TopicCatalog.
type Event struct {
	ID         string    `json:"id"`         // unique per event
	Type       string    `json:"type"`       // e.g. "catalog.service.created"
	Source     string    `json:"source"`     // producing service
	OccurredAt time.Time `json:"occurredAt"` // UTC
	EntityID   string    `json:"entityId"`   // department or service ID; also the message key
	Data       any       `json:"data,omitempty"`
}

// KafkaPublisher writes events asynchronously: Publish returns immediately and delivery errors
// are logged, so a slow or unavailable broker never delays an admin's request.
type KafkaPublisher struct {
	w      *kafka.Writer
	source string
	logger *slog.Logger
}

// NewKafkaPublisher builds a publisher for brokers (comma-separated host:port list).
func NewKafkaPublisher(brokers, source string, logger *slog.Logger) *KafkaPublisher {
	return &KafkaPublisher{
		source: source, logger: logger,
		w: &kafka.Writer{
			Addr:         kafka.TCP(strings.Split(brokers, ",")...),
			Topic:        TopicCatalog,
			Balancer:     &kafka.Hash{},
			RequiredAcks: kafka.RequireAll,
			BatchTimeout: 10 * time.Millisecond,
			WriteTimeout: 10 * time.Second,
			Async:        true,
			Completion: func(msgs []kafka.Message, err error) {
				if err != nil {
					for _, m := range msgs {
						logger.Error("event not delivered to kafka", "key", string(m.Key), "err", err)
					}
				}
			},
		},
	}
}

// Publish queues one event for delivery.
func (p *KafkaPublisher) Publish(ctx context.Context, eventType, entityID string, data any) {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	value, err := json.Marshal(Event{
		ID: hex.EncodeToString(b), Type: eventType, Source: p.source,
		OccurredAt: time.Now().UTC(), EntityID: entityID, Data: data,
	})
	if err != nil {
		p.logger.Error("encode event", "type", eventType, "err", err)
		return
	}
	if err := p.w.WriteMessages(context.WithoutCancel(ctx), kafka.Message{
		Key: []byte(entityID), Value: value,
		Headers: []kafka.Header{{Key: "type", Value: []byte(eventType)}},
	}); err != nil {
		p.logger.Error("queue event", "type", eventType, "err", err)
	}
}

// Close flushes pending events; call it on shutdown.
func (p *KafkaPublisher) Close() error { return p.w.Close() }
