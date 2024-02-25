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

	"github.com/woreda/booking/appointment-service/catalog"
	"github.com/woreda/booking/appointment-service/config"
	"github.com/woreda/booking/appointment-service/controller"
	"github.com/woreda/booking/appointment-service/events"
	"github.com/woreda/booking/appointment-service/repository"
	"github.com/woreda/booking/appointment-service/routes"
	"github.com/woreda/booking/appointment-service/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "appointment-service")
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
	var publisher service.Publisher = service.LogPublisher{}
	if cfg.KafkaBrokers != "" {
		kp := events.NewKafkaPublisher(cfg.KafkaBrokers, "appointment-service", logger)
		defer kp.Close() // flush queued events on shutdown
		publisher = kp
		logger.Info("streaming events to kafka", "brokers", cfg.KafkaBrokers, "topic", events.TopicAppointments)
	}
	catalogClient, err := catalog.New(cfg.CatalogGRPCAddr)
	if err != nil {
		logger.Error("catalog client", "err", err)
		os.Exit(1)
	}
	defer catalogClient.Close()
	logger.Info("catalog lookups via gRPC", "addr", cfg.CatalogGRPCAddr)
	svc := service.New(repo, publisher, catalogClient)
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
