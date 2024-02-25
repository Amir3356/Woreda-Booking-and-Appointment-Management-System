// Package catalog is the gRPC client for department-service's catalog API (see server/proto).
// appointment-service uses it instead of reading the services/departments tables directly.
package catalog

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	catalogv1 "github.com/woreda/booking/proto/gen/woreda/catalog/v1"

	"github.com/woreda/booking/appointment-service/model"
)

// callTimeout bounds one lookup, retries included, so a slow catalog cannot stall a booking.
const callTimeout = 3 * time.Second

// GetService is read-only, so it is safe to retry when department-service is briefly
// unreachable (e.g. restarting).
const serviceConfig = `{
  "methodConfig": [{
    "name": [{"service": "woreda.catalog.v1.CatalogService"}],
    "retryPolicy": {
      "maxAttempts": 3,
      "initialBackoff": "0.1s",
      "maxBackoff": "1s",
      "backoffMultiplier": 2,
      "retryableStatusCodes": ["UNAVAILABLE"]
    }
  }]
}`

// Client looks up catalog entries over gRPC.
type Client struct {
	conn *grpc.ClientConn
	api  catalogv1.CatalogServiceClient
}

// New connects lazily to addr (host:port); the first call establishes the connection.
// Traffic stays on the internal Docker network, so it is plaintext.
func New(addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultServiceConfig(serviceConfig),
	)
	if err != nil {
		return nil, fmt.Errorf("catalog client for %s: %w", addr, err)
	}
	return &Client{conn: conn, api: catalogv1.NewCatalogServiceClient(conn)}, nil
}

// Close releases the connection.
func (c *Client) Close() error { return c.conn.Close() }

// GetService returns the service and its department. Errors wrap model.ErrNotFound when the
// service does not exist, and model.ErrUnavailable when department-service cannot answer.
func (c *Client) GetService(ctx context.Context, id string) (*model.CatalogService, error) {
	ctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	resp, err := c.api.GetService(ctx, &catalogv1.GetServiceRequest{ServiceId: id})
	if err != nil {
		switch status.Code(err) {
		case codes.NotFound:
			return nil, fmt.Errorf("%w: service %s", model.ErrNotFound, id)
		case codes.Unavailable, codes.DeadlineExceeded:
			return nil, fmt.Errorf("%w: catalog: %v", model.ErrUnavailable, err)
		default:
			return nil, fmt.Errorf("catalog GetService: %w", err)
		}
	}
	svc, dept := resp.GetService(), resp.GetDepartment()
	return &model.CatalogService{
		ID: svc.GetId(), Name: svc.GetName(), Active: svc.GetIsActive(),
		RequiredDocuments: svc.GetRequiredDocuments(),
		DepartmentID:      dept.GetId(), DepartmentName: dept.GetName(),
		DepartmentActive: dept.GetIsActive(), BuildingRoom: dept.GetBuildingRoom(),
	}, nil
}
