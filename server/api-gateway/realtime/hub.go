// Package realtime pushes live notifications to open browser pages over WebSocket.
//
// Browsers connect to GET /api/v1/ws. The gateway's Kafka consumers call Broadcast when
// something changed (e.g. the service catalog); pages react by re-fetching what they show.
// Messages are small notices without personal data, so every connected page may receive them.
package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	sendBuffer   = 16               // queued messages per page before it is treated as stuck
	writeTimeout = 5 * time.Second  // one message to one page
	pingInterval = 25 * time.Second // keeps idle connections open through proxies
)

// Message is what pages receive, as JSON.
type Message struct {
	Type     string `json:"type"`               // e.g. "catalog.changed"
	Event    string `json:"event,omitempty"`    // the underlying event, e.g. "catalog.service.created"
	EntityID string `json:"entityId,omitempty"` // what changed
}

// Hub tracks connected pages and fans messages out to them.
type Hub struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
	origins []string // allowed page origins as host[:port], e.g. "localhost:3000"
	logger  *slog.Logger
}

// NewHub accepts connections from pages served at allowedOrigins (e.g. "http://localhost:3000").
func NewHub(allowedOrigins []string, logger *slog.Logger) *Hub {
	var hosts []string
	for _, o := range allowedOrigins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			hosts = append(hosts, u.Host)
		} else if o == "*" {
			hosts = append(hosts, "*")
		}
	}
	return &Hub{clients: map[chan []byte]struct{}{}, origins: hosts, logger: logger}
}

// Broadcast sends msg to every connected page. A page that is not keeping up is disconnected;
// its client reconnects and re-fetches, so nothing is lost for good.
func (h *Hub) Broadcast(msg Message) {
	b, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for send := range h.clients {
		select {
		case send <- b:
		default:
			delete(h.clients, send)
			close(send)
		}
	}
}

// Count returns the number of connected pages.
func (h *Hub) Count() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clients)
}

// ServeHTTP upgrades the request to a WebSocket and streams messages until the page leaves.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.origins})
	if err != nil {
		h.logger.Warn("websocket upgrade refused", "origin", r.Header.Get("Origin"), "err", err)
		return // Accept has already written the HTTP error
	}
	defer conn.CloseNow()

	send := make(chan []byte, sendBuffer)
	h.mu.Lock()
	h.clients[send] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		if _, ok := h.clients[send]; ok {
			delete(h.clients, send)
			close(send)
		}
		h.mu.Unlock()
	}()

	// Pages only listen; CloseRead handles pings/close frames and cancels ctx when they go away.
	ctx := conn.CloseRead(r.Context())
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()

	if err := write(ctx, conn, mustJSON(Message{Type: "connected"})); err != nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case b, ok := <-send:
			if !ok {
				conn.Close(websocket.StatusTryAgainLater, "too slow")
				return
			}
			if err := write(ctx, conn, b); err != nil {
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func write(ctx context.Context, conn *websocket.Conn, b []byte) error {
	ctx, cancel := context.WithTimeout(ctx, writeTimeout)
	defer cancel()
	return conn.Write(ctx, websocket.MessageText, b)
}

func mustJSON(m Message) []byte {
	b, _ := json.Marshal(m)
	return b
}
