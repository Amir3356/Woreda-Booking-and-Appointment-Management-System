// Table "system_settings": a single row, id 'primary'.

/** system_settings row -> API shape (reception_phone is exposed as emergencyPhone). */
export function fromRow(r) {
  return {
    woredaName: r.woreda_name,
    cityRegion: r.city_region,
    hotline: r.hotline,
    emergencyPhone: r.reception_phone,
    smsGatewayActive: r.sms_gateway_active,
    autoApproveBookings: r.auto_approve_bookings,
    advanceBookingDays: r.advance_booking_days,
    cancellationCutoffHours: r.cancellation_cutoff_hours,
    maxParallelSlots: r.max_parallel_slots,
  };
}
