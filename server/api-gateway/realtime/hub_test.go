package realtime

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestHubBroadcast(t *testing.T) {
	hub := NewHub([]string{"http://localhost:3000"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	srv := httptest.NewServer(hub)
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// A page from another site is refused.
	if _, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"http://evil.example"}}}); err == nil {
		t.Fatal("connection from a non-allowed origin must be refused")
	}

	conn, _, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"http://localhost:3000"}}})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()

	read := func() Message {
		_, b, err := conn.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var m Message
		_ = json.Unmarshal(b, &m)
		return m
	}
	if m := read(); m.Type != "connected" {
		t.Fatalf("first message = %+v, want connected", m)
	}
	for hub.Count() == 0 {
		time.Sleep(5 * time.Millisecond)
	}
	hub.Broadcast(Message{Type: "catalog.changed", Event: "catalog.service.created", EntityID: "srv-1"})
	if m := read(); m.Type != "catalog.changed" || m.EntityID != "srv-1" {
		t.Fatalf("got %+v", m)
	}

	conn.Close(websocket.StatusNormalClosure, "")
	deadline := time.Now().Add(2 * time.Second)
	for hub.Count() != 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if hub.Count() != 0 {
		t.Fatal("closed page still registered")
	}
}
