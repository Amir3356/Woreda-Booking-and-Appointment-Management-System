package repository

import (
	"context"

	"github.com/woreda/booking/user-service/model"
)

// GetSettings loads the 'primary' system_settings row.
func (r *Repository) GetSettings(ctx context.Context) (*model.Settings, error) {
	var s model.Settings
	err := r.db.QueryRow(ctx, `
		SELECT woreda_name, city_region, hotline, reception_phone, sms_gateway_active,
		       auto_approve_bookings, advance_booking_days, cancellation_cutoff_hours, max_parallel_slots
		FROM system_settings WHERE id = 'primary'`,
	).Scan(&s.WoredaName, &s.CityRegion, &s.Hotline, &s.EmergencyPhone, &s.SMSGatewayActive,
		&s.AutoApproveBookings, &s.AdvanceBookingDays, &s.CancellationCutoffHours, &s.MaxParallelSlots)
	if err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

// SaveSettings upserts the 'primary' system_settings row.
func (r *Repository) SaveSettings(ctx context.Context, s model.Settings) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO system_settings (id, woreda_name, city_region, hotline, reception_phone, sms_gateway_active,
		       auto_approve_bookings, advance_booking_days, cancellation_cutoff_hours, max_parallel_slots, updated_at)
		VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET
		       woreda_name = EXCLUDED.woreda_name, city_region = EXCLUDED.city_region, hotline = EXCLUDED.hotline,
		       reception_phone = EXCLUDED.reception_phone, sms_gateway_active = EXCLUDED.sms_gateway_active,
		       auto_approve_bookings = EXCLUDED.auto_approve_bookings, advance_booking_days = EXCLUDED.advance_booking_days,
		       cancellation_cutoff_hours = EXCLUDED.cancellation_cutoff_hours,
		       max_parallel_slots = EXCLUDED.max_parallel_slots, updated_at = CURRENT_TIMESTAMP`,
		s.WoredaName, s.CityRegion, s.Hotline, s.EmergencyPhone, s.SMSGatewayActive,
		s.AutoApproveBookings, s.AdvanceBookingDays, s.CancellationCutoffHours, s.MaxParallelSlots)
	return err
}
