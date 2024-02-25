package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/woreda/booking/department-service/config"
	"github.com/woreda/booking/department-service/controller"
	"github.com/woreda/booking/department-service/events"
	"github.com/woreda/booking/department-service/grpcserver"
	"github.com/woreda/booking/department-service/repository"
	"github.com/woreda/booking/department-service/routes"
	"github.com/woreda/booking/department-service/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "department-service")
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
	var publisher service.Publisher = service.NopPublisher{}
	if cfg.KafkaBrokers != "" {
		kp := events.NewKafkaPublisher(cfg.KafkaBrokers, "department-service", logger)
		defer kp.Close() // flush queued events on shutdown
		publisher = kp
		logger.Info("streaming catalog events to kafka", "brokers", cfg.KafkaBrokers, "topic", events.TopicCatalog)
	} else {
		logger.Warn("KAFKA_BROKERS not set: catalog changes are not streamed")
	}
	svc := service.New(repo, publisher)
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

	// Internal gRPC catalog API for other services.
	grpcSrv := grpcserver.New(repo, logger)
	lis, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		logger.Error("grpc listen", "err", err)
		os.Exit(1)
	}
	go func() {
		logger.Info("grpc listening", "addr", lis.Addr().String())
		if err := grpcSrv.Serve(lis); err != nil {
			logger.Error("grpc server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	grpcSrv.GracefulStop()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	logger.Info("stopped")
}
