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

	"github.com/woreda/booking/api-gateway/config"
	"github.com/woreda/booking/api-gateway/controller"
	"github.com/woreda/booking/api-gateway/middleware"
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

	// Define gateway endpoints and map them to the controller
	mux := http.NewServeMux()
	routes.Register(mux, ctrl)

	handler := middleware.Chain(mux,
		middleware.RequestID,
		middleware.RateLimit(300, time.Minute),
		middleware.Logging(logger),
		middleware.CORS(cfg.AllowedOrigins),
		middleware.Auth(cfg.JWTSecret),
	)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

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
