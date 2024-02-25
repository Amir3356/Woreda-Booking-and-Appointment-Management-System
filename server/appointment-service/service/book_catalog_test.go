package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/woreda/booking/appointment-service/model"
)

type fakeCatalog struct {
	svc *model.CatalogService
	err error
}

func (f fakeCatalog) GetService(context.Context, string) (*model.CatalogService, error) {
	return f.svc, f.err
}

// recordingRepo implements only Create; any other call panics via the nil embedded interface.
type recordingRepo struct {
	Repository
	created *model.Appointment
}

func (r *recordingRepo) Create(_ context.Context, a *model.Appointment) error {
	a.ID = "apt-test"
	r.created = a
	return nil
}

type nopPublisher struct{}

func (nopPublisher) Publish(context.Context, string, string, any) {}

func validBooking() model.BookRequest {
	return model.BookRequest{
		CitizenName: "Almaz Hailu", CitizenPhone: "+251911234567", ServiceID: "srv-1",
		Date: time.Now().AddDate(0, 0, 1).Format(time.DateOnly), TimeSlot: "09:00 AM",
	}
}

func TestBookUsesCatalog(t *testing.T) {
	caller := model.Caller{UserID: "usr-1", Role: "CITIZEN"}
	open := &model.CatalogService{ID: "srv-1", Name: "Birth Certificate", Active: true,
		DepartmentID: "dept-1", DepartmentName: "Kebele Administration", DepartmentActive: true}

	t.Run("fills department and service from the catalog", func(t *testing.T) {
		repo := &recordingRepo{}
		a, err := New(repo, nopPublisher{}, fakeCatalog{svc: open}).Book(context.Background(), caller, validBooking())
		if err != nil {
			t.Fatal(err)
		}
		if a.DepartmentID != "dept-1" || a.DepartmentName != "Kebele Administration" || a.ServiceName != "Birth Certificate" {
			t.Fatalf("catalog fields not copied: %+v", a)
		}
	})

	cases := []struct {
		name    string
		catalog fakeCatalog
		want    error
	}{
		{"unknown service", fakeCatalog{err: model.ErrNotFound}, ErrNotFound},
		{"inactive service", fakeCatalog{svc: &model.CatalogService{Active: false, DepartmentActive: true}}, ErrNotFound},
		{"inactive department", fakeCatalog{svc: &model.CatalogService{Active: true, DepartmentActive: false}}, ErrNotFound},
		{"catalog down", fakeCatalog{err: model.ErrUnavailable}, ErrUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &recordingRepo{}
			_, err := New(repo, nopPublisher{}, tc.catalog).Book(context.Background(), caller, validBooking())
			if !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
			if repo.created != nil {
				t.Fatal("appointment must not be stored")
			}
		})
	}
}
