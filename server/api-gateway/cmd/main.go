package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/woreda/booking/api-gateway/config"
	"github.com/woreda/booking/api-gateway/controller"
	"github.com/woreda/booking/api-gateway/events"
	"github.com/woreda/booking/api-gateway/middleware"
	"github.com/woreda/booking/api-gateway/realtime"
	"github.com/woreda/booking/api-gateway/routes"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "api-gateway")
	cfg := config.Load()

	// Initialize GatewayController to receive and coordinate forwarding to microservices
	ctrl, err := controller.New(cfg.Services, logger)
	if err != nil {
		logger.Error("initialize gateway controller", "err", err)
		os.Exit(1)
	}

	rdb := newRedis(cfg.RedisURL, logger)
	if rdb != nil {
		defer rdb.Close()
	}

	// Rate limiting is done by nginx in front of the gateway (server/nginx/nginx.conf).
	// Define gateway endpoints and map them to the controller
	mux := http.NewServeMux()
	routes.Register(mux, ctrl)

	// Live notices to open browser pages (WebSocket), fed by Kafka.
	hub := realtime.NewHub(cfg.AllowedOrigins, logger)
	mux.Handle("GET /api/v1/ws", hub)

	handler := middleware.Chain(mux,
		middleware.RequestID,
		middleware.Logging(logger),
		middleware.CORS(cfg.AllowedOrigins),
		middleware.Auth(cfg.JWTSecret, rdb, logger),
		middleware.Cache(rdb, logger),
	)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Appointment events (Kafka) clear cached availability, whichever service changed it.
	if cfg.KafkaBrokers != "" && rdb != nil {
		go events.RunCacheInvalidator(ctx, cfg.KafkaBrokers, rdb, logger)
	}
	// Catalog changes: refresh the cache and tell open pages (works without Redis too).
	if cfg.KafkaBrokers != "" {
		go events.RunCatalogListener(ctx, cfg.KafkaBrokers, rdb, hub, logger)
	}

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	logger.Info("stopped")
}

// newRedis returns nil when url is empty. An unreachable server is only logged: go-redis
// reconnects on its own and the middlewares fall back while it is down.
func newRedis(url string, logger *slog.Logger) *redis.Client {
	if url == "" {
		logger.Warn("REDIS_URL not set: response caching is off and logout does not revoke tokens")
		return nil
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		logger.Error("parse REDIS_URL", "err", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Warn("redis not reachable yet", "err", err)
	}
	return rdb
}
