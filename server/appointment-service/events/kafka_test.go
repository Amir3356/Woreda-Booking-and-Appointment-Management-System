package events

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

// Needs a running broker with the topic created, e.g. inside the compose network:
//
//	KAFKA_TEST_BROKERS=kafka:9092 go test ./events/
func TestPublishRoundTrip(t *testing.T) {
	brokers := os.Getenv("KAFKA_TEST_BROKERS")
	if brokers == "" {
		t.Skip("KAFKA_TEST_BROKERS not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	apptID := "test-appt-" + newID()[:8]
	pub := NewKafkaPublisher(brokers, "appointment-service-test", slog.New(slog.NewTextHandler(io.Discard, nil)))
	pub.Publish(ctx, "appointment.booked", apptID, map[string]string{"serviceName": "Birth Certificate"})
	if err := pub.Close(); err != nil { // flushes the async write
		t.Fatal(err)
	}

	// Find the partition the key hashed to and read back from the end of it.
	conn, err := kafka.DialContext(ctx, "tcp", strings.Split(brokers, ",")[0])
	if err != nil {
		t.Fatal(err)
	}
	parts, err := conn.ReadPartitions(TopicAppointments)
	conn.Close()
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range parts {
		r := kafka.NewReader(kafka.ReaderConfig{
			Brokers: strings.Split(brokers, ","), Topic: TopicAppointments, Partition: p.ID, MaxWait: 200 * time.Millisecond,
		})
		last, err := r.ReadLag(ctx) // lag from offset 0 == number of messages
		if err != nil || last == 0 {
			r.Close()
			continue
		}
		_ = r.SetOffset(kafka.FirstOffset)
		for i := int64(0); i < last; i++ {
			m, err := r.ReadMessage(ctx)
			if err != nil {
				break
			}
			if string(m.Key) != apptID {
				continue
			}
			var ev Event
			if err := json.Unmarshal(m.Value, &ev); err != nil {
				t.Fatal(err)
			}
			if ev.Type != "appointment.booked" || ev.AppointmentID != apptID || ev.ID == "" || ev.OccurredAt.IsZero() {
				t.Fatalf("unexpected event: %+v", ev)
			}
			t.Logf("received on partition %d offset %d: %s", m.Partition, m.Offset, m.Value)
			r.Close()
			return
		}
		r.Close()
	}
	t.Fatalf("event for %s not found on %s", apptID, TopicAppointments)
}
