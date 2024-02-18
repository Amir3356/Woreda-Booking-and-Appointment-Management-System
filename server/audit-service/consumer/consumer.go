package consumer

import (
	"context"
	"log/slog"

	"github.com/woreda/booking/audit-service/service"
)

// LogConsumer listens for asynchronous audit events.
type LogConsumer struct {
	svc    *service.Service
	logger *slog.Logger
}

// NewLogConsumer returns an instantiated LogConsumer.
func NewLogConsumer(svc *service.Service, logger *slog.Logger) *LogConsumer {
	return &LogConsumer{svc: svc, logger: logger}
}

// Start begins event listening loop until ctx is cancelled.
func (c *LogConsumer) Start(ctx context.Context) error {
	c.logger.Info("audit event consumer started")
	<-ctx.Done()
	c.logger.Info("audit event consumer stopped")
	return nil
}

