// Package events consumes the appointment event stream (topic woreda.appointments) produced by
// appointment-service and booking-service.
package events

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"

	"github.com/woreda/booking/api-gateway/middleware"
	"github.com/woreda/booking/api-gateway/realtime"
)

// TopicAppointments must match the producers' topic.
const TopicAppointments = "woreda.appointments"

// consumerGroup identifies the gateway's cache invalidator; Kafka tracks its read position.
const consumerGroup = "api-gateway-cache"

// event is the subset of the producers' envelope this consumer needs.
type event struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Source        string `json:"source"`
	AppointmentID string `json:"appointmentId"`
}

// RunCacheInvalidator clears cached slot availability whenever any appointment changes
// (booked, approved, rescheduled, cancelled, checked in, completed ...), whichever service
// made the change. It blocks until ctx is cancelled.
func RunCacheInvalidator(ctx context.Context, brokers string, rdb *redis.Client, logger *slog.Logger) {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     strings.Split(brokers, ","),
		GroupID:     consumerGroup,
		Topic:       TopicAppointments,
		StartOffset: kafka.LastOffset, // a new group skips history: old events cannot make the cache stale
		MinBytes:    1,
		MaxBytes:    1 << 20,
		MaxWait:     250 * time.Millisecond,
	})
	defer r.Close()
	logger.Info("consuming appointment events", "topic", TopicAppointments, "group", consumerGroup)

	for {
		msg, err := r.ReadMessage(ctx) // commits the offset after returning
		if err != nil {
			if errors.Is(err, context.Canceled) || ctx.Err() != nil {
				return
			}
			logger.Warn("kafka read failed, retrying", "err", err)
			time.Sleep(2 * time.Second)
			continue
		}
		var ev event
		if err := json.Unmarshal(msg.Value, &ev); err != nil {
			logger.Warn("skipping malformed event", "offset", msg.Offset, "err", err)
			continue
		}
		if err := middleware.InvalidateGroup(ctx, rdb, middleware.GroupAvailability); err != nil {
			logger.Warn("availability cache not cleared; entries expire on their TTL", "event", ev.Type, "err", err)
			continue
		}
		logger.Info("availability cache cleared by event",
			"event", ev.Type, "source", ev.Source, "appointmentId", ev.AppointmentID, "partition", msg.Partition, "offset", msg.Offset)
	}
}

// TopicCatalog carries department/service changes produced by department-service.
const TopicCatalog = "woreda.catalog"

// RunCatalogListener reacts to catalog changes: it clears the cached department/service lists
// and then tells every open page (WebSocket) to re-fetch. Every gateway instance must see every
// change to reach its own pages, so it reads the topic directly (no consumer group), starting
// from the newest message. It blocks until ctx is cancelled.
func RunCatalogListener(ctx context.Context, brokers string, rdb *redis.Client, hub *realtime.Hub, logger *slog.Logger) {
	for ctx.Err() == nil {
		r := kafka.NewReader(kafka.ReaderConfig{
			Brokers: strings.Split(brokers, ","), Topic: TopicCatalog, Partition: 0,
			MinBytes: 1, MaxBytes: 1 << 20, MaxWait: 250 * time.Millisecond,
		})
		if err := r.SetOffset(kafka.LastOffset); err != nil {
			logger.Warn("catalog listener: set offset", "err", err)
		}
		logger.Info("listening for catalog changes", "topic", TopicCatalog)
		for {
			msg, err := r.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() == nil {
					logger.Warn("catalog listener: read failed, reconnecting", "err", err)
					time.Sleep(2 * time.Second)
				}
				break
			}
			var ev struct {
				Type     string `json:"type"`
				EntityID string `json:"entityId"`
			}
			if err := json.Unmarshal(msg.Value, &ev); err != nil {
				logger.Warn("skipping malformed catalog event", "offset", msg.Offset, "err", err)
				continue
			}
			// Clear first, so the pages' re-fetch below cannot get the old cached list.
			if rdb != nil {
				if err := middleware.InvalidateGroup(ctx, rdb, middleware.GroupCatalog); err != nil {
					logger.Warn("catalog cache not cleared; entries expire on their TTL", "err", err)
				}
			}
			hub.Broadcast(realtime.Message{Type: "catalog.changed", Event: ev.Type, EntityID: ev.EntityID})
			logger.Info("catalog change pushed to pages", "event", ev.Type, "entityId", ev.EntityID, "pages", hub.Count())
		}
		r.Close()
	}
}
