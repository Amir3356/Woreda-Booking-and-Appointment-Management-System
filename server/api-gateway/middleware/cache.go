package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Response caching for frequently requested public data.
//
// Only the GET routes listed in cachedRoutes are cached, and only when the upstream answers
// 200 with JSON. Their handlers do not depend on who is calling, so one cached copy can be
// served to everyone. Each cached entry belongs to a group; any successful write (POST, PUT,
// PATCH, DELETE) to a path in invalidatedBy drops every entry of the affected groups, so
// users see changes immediately. The TTL only bounds staleness from writes that bypass the
// gateway (e.g. SQL run directly against the database).

const (
	groupCatalog      = "catalog"      // departments and services lists
	groupAvailability = "availability" // per-service, per-date slot availability
)

type cachedRoute struct {
	path  string
	group string
	ttl   time.Duration
}

var cachedRoutes = []cachedRoute{
	{"/api/v1/departments", groupCatalog, 10 * time.Minute},
	{"/api/v1/services", groupCatalog, 10 * time.Minute},
	{"/api/v1/schedules/availability", groupAvailability, 30 * time.Second},
}

// invalidatedBy maps a write path prefix to the cache groups it makes stale.
var invalidatedBy = []struct {
	prefix string
	groups []string
}{
	{"/api/v1/departments", []string{groupCatalog}},
	{"/api/v1/services", []string{groupCatalog}},
	{"/api/v1/appointments", []string{groupAvailability}},   // book, cancel, reschedule, status
	{"/api/v1/queue", []string{groupAvailability}},          // check-in / finalize change appointment state
	{"/api/v1/schedules", []string{groupAvailability}},      // opening hours
	{"/api/v1/admin/settings", []string{groupAvailability}}, // max parallel slots
}

const cacheKeyPrefix = "cache:"

// cachedEntry is what is stored in Redis for one response.
type cachedEntry struct {
	ContentType string          `json:"ct"`
	Body        json.RawMessage `json:"body"`
}

// Cache serves cachedRoutes from Redis and invalidates them on writes. With rdb nil it is a no-op.
// Redis errors are logged and the request goes to the upstream service as if there were no cache.
func Cache(rdb *redis.Client, logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		if rdb == nil {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet:
				if route, ok := matchCachedRoute(r.URL.Path); ok {
					serveCached(w, r, next, rdb, route, logger)
					return
				}
				next.ServeHTTP(w, r)
			case http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
			default:
				rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
				next.ServeHTTP(rec, r)
				if rec.status >= 200 && rec.status < 300 {
					invalidate(r.Context(), rdb, r.URL.Path, logger)
				}
			}
		})
	}
}

func matchCachedRoute(path string) (cachedRoute, bool) {
	path = strings.TrimSuffix(path, "/")
	for _, c := range cachedRoutes {
		if path == c.path {
			return c, true
		}
	}
	return cachedRoute{}, false
}

func serveCached(w http.ResponseWriter, r *http.Request, next http.Handler, rdb *redis.Client, route cachedRoute, logger *slog.Logger) {
	key := cacheKey(route, r.URL)

	ctx, cancel := context.WithTimeout(r.Context(), 200*time.Millisecond)
	raw, err := rdb.Get(ctx, key).Bytes()
	cancel()
	if err == nil {
		var e cachedEntry
		if json.Unmarshal(raw, &e) == nil {
			w.Header().Set("Content-Type", e.ContentType)
			w.Header().Set("X-Cache", "HIT")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(refreshMeta(e.Body, r))
			return
		}
	} else if err != redis.Nil {
		logger.Warn("cache read failed, serving from upstream", "key", key, "err", err)
	}

	// Miss: let the upstream answer, copying the body so it can be stored.
	w.Header().Set("X-Cache", "MISS")
	rec := &bodyRecorder{ResponseWriter: w, status: http.StatusOK}
	next.ServeHTTP(rec, r)
	ct := rec.Header().Get("Content-Type")
	if rec.status != http.StatusOK || !strings.HasPrefix(ct, "application/json") || !json.Valid(rec.body.Bytes()) {
		return
	}
	entry, _ := json.Marshal(cachedEntry{ContentType: ct, Body: rec.body.Bytes()})
	groupSet := cacheKeyPrefix + "group:" + route.group

	ctx, cancel = context.WithTimeout(context.WithoutCancel(r.Context()), 200*time.Millisecond)
	defer cancel()
	_, err = rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Set(ctx, key, entry, route.ttl)
		p.SAdd(ctx, groupSet, key)
		p.Expire(ctx, groupSet, route.ttl)
		return nil
	})
	if err != nil {
		logger.Warn("cache write failed", "key", key, "err", err)
	}
}

// cacheKey is cache:<group>:<path>?<query with keys sorted>, so ?a=1&b=2 and ?b=2&a=1 share an entry.
func cacheKey(route cachedRoute, u *url.URL) string {
	return cacheKeyPrefix + route.group + ":" + route.path + "?" + u.Query().Encode()
}

// invalidate deletes every cached entry in the groups made stale by a write to path.
func invalidate(ctx context.Context, rdb *redis.Client, path string, logger *slog.Logger) {
	for _, inv := range invalidatedBy {
		if path != inv.prefix && !strings.HasPrefix(path, inv.prefix+"/") {
			continue
		}
		for _, g := range inv.groups {
			if err := InvalidateGroup(ctx, rdb, g); err != nil {
				logger.Warn("cache invalidation failed; entries expire on their TTL", "group", g, "err", err)
			}
		}
	}
}

// GroupAvailability is the cache group holding slot availability (cleared on appointment events).
const GroupAvailability = groupAvailability

// GroupCatalog is the cache group holding department and service lists (cleared on catalog events).
const GroupCatalog = groupCatalog

// InvalidateGroup deletes every cached entry of group. It is also called by the Kafka consumer.
func InvalidateGroup(ctx context.Context, rdb *redis.Client, group string) error {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 500*time.Millisecond)
	defer cancel()
	groupSet := cacheKeyPrefix + "group:" + group
	keys, err := rdb.SMembers(ctx, groupSet).Result()
	if err != nil {
		return err
	}
	return rdb.Del(ctx, append(keys, groupSet)...).Err()
}

// refreshMeta replaces meta.requestId and meta.timestamp in a cached envelope so a cached
// response carries this request's id, not the one that first filled the cache.
func refreshMeta(body []byte, r *http.Request) []byte {
	var env map[string]json.RawMessage
	if json.Unmarshal(body, &env) != nil {
		return body
	}
	if _, ok := env["meta"]; !ok {
		return body
	}
	env["meta"], _ = json.Marshal(map[string]string{
		"requestId": r.Header.Get(RequestIDHeader),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	out, err := json.Marshal(env)
	if err != nil {
		return body
	}
	return out
}

// bodyRecorder passes the response through while keeping a copy of the body.
type bodyRecorder struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (b *bodyRecorder) WriteHeader(code int) {
	b.status = code
	b.ResponseWriter.WriteHeader(code)
}

func (b *bodyRecorder) Write(p []byte) (int, error) {
	b.body.Write(p)
	return b.ResponseWriter.Write(p)
}
