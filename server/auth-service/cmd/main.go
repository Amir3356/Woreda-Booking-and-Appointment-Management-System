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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/woreda/booking/auth-service/config"
	"github.com/woreda/booking/auth-service/controller"
	"github.com/woreda/booking/auth-service/repository"
	"github.com/woreda/booking/auth-service/routes"
	"github.com/woreda/booking/auth-service/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "auth-service")
	slog.SetDefault(logger)
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("create db pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	pingCtx, cancelPing := context.WithTimeout(ctx, 5*time.Second)
	defer cancelPing()
	if err := pool.Ping(pingCtx); err != nil {
		logger.Error("ping db", "err", err)
		os.Exit(1)
	}

	// Constructor injection: repository → service → controller → routes.
	repo := repository.New(pool)
	var sessions service.SessionStore
	if cfg.RedisURL == "" {
		logger.Warn("REDIS_URL not set: logout does not revoke tokens and login lockout is off")
	} else {
		opts, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			logger.Error("parse REDIS_URL", "err", err)
			os.Exit(1)
		}
		rdb := redis.NewClient(opts)
		defer rdb.Close()
		if err := rdb.Ping(pingCtx).Err(); err != nil {
			logger.Warn("redis not reachable yet", "err", err)
		}
		sessions = repository.NewSessionStore(rdb)
	}
	svc := service.New(repo, sessions, cfg.JWTSecret)
	ctrl := controller.New(svc)
	root := routes.Register(http.NewServeMux(), ctrl, cfg.JWTSecret, logger)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: root, ReadHeaderTimeout: 5 * time.Second}
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
