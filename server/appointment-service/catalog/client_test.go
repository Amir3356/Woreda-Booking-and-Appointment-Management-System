package catalog

import (
	"context"
	"errors"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	catalogv1 "github.com/woreda/booking/proto/gen/woreda/catalog/v1"

	"github.com/woreda/booking/appointment-service/model"
)

type fakeServer struct {
	catalogv1.UnimplementedCatalogServiceServer
}

func (fakeServer) GetService(_ context.Context, req *catalogv1.GetServiceRequest) (*catalogv1.GetServiceResponse, error) {
	if req.GetServiceId() != "srv-1" {
		return nil, status.Error(codes.NotFound, "service not found")
	}
	return &catalogv1.GetServiceResponse{
		Service:    &catalogv1.Service{Id: "srv-1", Name: "Birth Certificate", IsActive: true, RequiredDocuments: []string{"Kebele ID"}},
		Department: &catalogv1.Department{Id: "dept-1", Name: "Kebele Administration", BuildingRoom: "Room 102", IsActive: true},
	}, nil
}

func TestClientOverGRPC(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := grpc.NewServer()
	catalogv1.RegisterCatalogServiceServer(srv, fakeServer{})
	go srv.Serve(lis)

	c, err := New(lis.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	ctx := context.Background()

	got, err := c.GetService(ctx, "srv-1")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Bookable() || got.DepartmentName != "Kebele Administration" || got.BuildingRoom != "Room 102" || got.RequiredDocuments[0] != "Kebele ID" {
		t.Fatalf("unexpected mapping: %+v", got)
	}

	if _, err := c.GetService(ctx, "missing"); !errors.Is(err, model.ErrNotFound) {
		t.Fatalf("missing service: err = %v, want ErrNotFound", err)
	}

	srv.Stop() // department-service down
	if _, err := c.GetService(ctx, "srv-1"); !errors.Is(err, model.ErrUnavailable) {
		t.Fatalf("server down: err = %v, want ErrUnavailable", err)
	}
}
