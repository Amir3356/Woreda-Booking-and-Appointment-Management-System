package middleware

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

	"github.com/redis/go-redis/v9"
)

// Needs a real Redis: REDIS_TEST_URL=redis://localhost:6379/15 go test ./middleware/
// The database in that URL is flushed.
func testRedis(t *testing.T) *redis.Client {
	url := os.Getenv("REDIS_TEST_URL")
	if url == "" {
		t.Skip("REDIS_TEST_URL not set")
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(opts)
	if err := rdb.FlushDB(context.Background()).Err(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { rdb.Close() })
	return rdb
}

func TestCache(t *testing.T) {
	rdb := testRedis(t)
	var upstreamCalls atomic.Int32
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			upstreamCalls.Add(1)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true, "data": []string{"Civil Registration"},
			"meta": map[string]string{"requestId": r.Header.Get(RequestIDHeader)},
		})
	})
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := Cache(rdb, logger)(upstream)

	do := func(method, target, reqID string) (*httptest.ResponseRecorder, map[string]any) {
		req := httptest.NewRequest(method, target, nil)
		req.Header.Set(RequestIDHeader, reqID)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		var body map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		return rec, body
	}

	rec, _ := do("GET", "/api/v1/departments?isActive=true", "req-1")
	if got := rec.Header().Get("X-Cache"); got != "MISS" {
		t.Fatalf("first GET: X-Cache=%q, want MISS", got)
	}
	rec, body := do("GET", "/api/v1/departments?isActive=true", "req-2")
	if got := rec.Header().Get("X-Cache"); got != "HIT" {
		t.Fatalf("second GET: X-Cache=%q, want HIT", got)
	}
	if upstreamCalls.Load() != 1 {
		t.Fatalf("upstream called %d times, want 1", upstreamCalls.Load())
	}
	if id := body["meta"].(map[string]any)["requestId"]; id != "req-2" {
		t.Fatalf("cached response requestId=%v, want req-2", id)
	}

	// Different query string is a different entry.
	if rec, _ := do("GET", "/api/v1/departments", "req-3"); rec.Header().Get("X-Cache") != "MISS" {
		t.Fatal("GET without query should miss")
	}

	// Availability is unaffected by a department write, but the catalog is cleared.
	do("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-4")
	do("PUT", "/api/v1/departments/abc", "req-5")
	if rec, _ := do("GET", "/api/v1/departments?isActive=true", "req-6"); rec.Header().Get("X-Cache") != "MISS" {
		t.Fatal("departments should be invalidated by a department write")
	}
	if rec, _ := do("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-7"); rec.Header().Get("X-Cache") != "HIT" {
		t.Fatal("availability should survive a department write")
	}

	// Booking an appointment clears availability.
	do("POST", "/api/v1/appointments", "req-8")
	if rec, _ := do("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-9"); rec.Header().Get("X-Cache") != "MISS" {
		t.Fatal("availability should be invalidated by booking")
	}

	// Routes not in the list are never cached.
	if rec, _ := do("GET", "/api/v1/appointments/mine", "req-10"); rec.Header().Get("X-Cache") != "" {
		t.Fatal("per-user routes must not be cached")
	}
}

func TestCacheSkipsErrors(t *testing.T) {
	rdb := testRedis(t)
	failing := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"success":false}`))
	})
	h := Cache(rdb, slog.New(slog.NewTextHandler(io.Discard, nil)))(failing)
	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/services", nil))
		if rec.Header().Get("X-Cache") != "MISS" {
			t.Fatalf("attempt %d: error responses must not be cached", i)
		}
	}
}
