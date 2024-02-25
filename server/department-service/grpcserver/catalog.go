// Package grpcserver exposes the catalog to other services over gRPC (see server/proto).
package grpcserver

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	catalogv1 "github.com/woreda/booking/proto/gen/woreda/catalog/v1"

	"github.com/woreda/booking/department-service/model"
)

// Repository is the read access the gRPC API needs (implemented by repository.Repository).
type Repository interface {
	GetService(ctx context.Context, id string) (*model.Service, error)
	GetDepartment(ctx context.Context, id string) (*model.Department, error)
}

// CatalogServer implements catalogv1.CatalogServiceServer.
type CatalogServer struct {
	catalogv1.UnimplementedCatalogServiceServer
	repo Repository
}

// GetService returns a service and its department.
func (s *CatalogServer) GetService(ctx context.Context, req *catalogv1.GetServiceRequest) (*catalogv1.GetServiceResponse, error) {
	if req.GetServiceId() == "" {
		return nil, status.Error(codes.InvalidArgument, "service_id is required")
	}
	svc, err := s.repo.GetService(ctx, req.GetServiceId())
	if err != nil {
		return nil, toStatus(err, "service")
	}
	dept, err := s.repo.GetDepartment(ctx, svc.DepartmentID)
	if err != nil {
		return nil, toStatus(err, "department")
	}
	return &catalogv1.GetServiceResponse{
		Service: &catalogv1.Service{
			Id: svc.ID, DepartmentId: svc.DepartmentID, Code: svc.Code, Name: svc.Name,
			DurationMinutes: int32(svc.DurationMinutes), DailyQuota: int32(svc.DailyQuota),
			RequiredDocuments: svc.RequiredDocuments, IsActive: svc.IsActive,
		},
		Department: &catalogv1.Department{
			Id: dept.ID, Code: dept.Code, Name: dept.Name, BuildingRoom: dept.BuildingRoom,
			ContactPhone: dept.ContactPhone, IsActive: dept.IsActive,
		},
	}, nil
}

func toStatus(err error, what string) error {
	if errors.Is(err, model.ErrNotFound) {
		return status.Errorf(codes.NotFound, "%s not found", what)
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return status.FromContextError(err).Err()
	}
	return status.Errorf(codes.Internal, "load %s: %v", what, err)
}

// New builds a gRPC server with the catalog API, the standard health service and request logging.
func New(repo Repository, logger *slog.Logger) *grpc.Server {
	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(logUnary(logger)))
	catalogv1.RegisterCatalogServiceServer(srv, &CatalogServer{repo: repo})
	hs := health.NewServer()
	hs.SetServingStatus(catalogv1.CatalogService_ServiceDesc.ServiceName, healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(srv, hs)
	return srv
}

func logUnary(logger *slog.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, next grpc.UnaryHandler) (any, error) {
		start := time.Now()
		resp, err := next(ctx, req)
		logger.Info("grpc", "method", info.FullMethod, "code", status.Code(err).String(), "duration", time.Since(start).String())
		return resp, err
	}
}
