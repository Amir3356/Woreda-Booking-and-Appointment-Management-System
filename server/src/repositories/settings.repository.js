// Data access for the single "system_settings" row (id 'primary').
import { one, query } from "../config/database.js";
import { fromRow } from "../models/settings.model.js";

/** The settings; created with the column defaults when missing. */
export async function findOrCreate() {
  await insertDefaultsIfMissing();
  return fromRow(await one("SELECT * FROM system_settings WHERE id = 'primary'"));
}

export async function upsert(s) {
  await query(
    `INSERT INTO system_settings (id, woreda_name, city_region, hotline, reception_phone, sms_gateway_active,
       auto_approve_bookings, advance_booking_days, cancellation_cutoff_hours, max_parallel_slots, updated_at)
     VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (id) DO UPDATE SET
       woreda_name = EXCLUDED.woreda_name, city_region = EXCLUDED.city_region, hotline = EXCLUDED.hotline,
       reception_phone = EXCLUDED.reception_phone, sms_gateway_active = EXCLUDED.sms_gateway_active,
       auto_approve_bookings = EXCLUDED.auto_approve_bookings, advance_booking_days = EXCLUDED.advance_booking_days,
       cancellation_cutoff_hours = EXCLUDED.cancellation_cutoff_hours, max_parallel_slots = EXCLUDED.max_parallel_slots,
       updated_at = now()`,
    [s.woredaName, s.cityRegion, s.hotline, s.emergencyPhone, s.smsGatewayActive, s.autoApproveBookings,
      s.advanceBookingDays, s.cancellationCutoffHours, s.maxParallelSlots],
  );
}

/** Inserts the default settings row unless it exists; returns true when created. */
export async function insertDefaultsIfMissing() {
  const { rowCount } = await query("INSERT INTO system_settings (id) VALUES ('primary') ON CONFLICT (id) DO NOTHING");
  return rowCount > 0;
}

/** system_settings.max_parallel_slots, or null when unset. */
export async function findMaxParallelSlots(client) {
  const row = await one("SELECT max_parallel_slots FROM system_settings WHERE id = 'primary'", [], client);
  return row?.max_parallel_slots ?? null;
}
