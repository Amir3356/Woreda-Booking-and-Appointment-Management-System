// Woreda-wide settings: a single row with id 'primary'.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("system_settings", {
    id: { type: "text", primaryKey: true, default: "primary", check: "id = 'primary'" },
    woreda_name: { type: "text", notNull: true, default: "Woreda 03 Public Administration" },
    city_region: { type: "text", notNull: true, default: "Addis Ababa City Administration" },
    hotline: { type: "text", notNull: true, default: "9840" },
    reception_phone: { type: "text", notNull: true, default: "+251 11 551 0000" },
    sms_gateway_active: { type: "boolean", notNull: true, default: true },
    auto_approve_bookings: { type: "boolean", notNull: true, default: false },
    advance_booking_days: { type: "integer", notNull: true, default: 14 },
    cancellation_cutoff_hours: { type: "integer", notNull: true, default: 4 },
    max_parallel_slots: { type: "integer", notNull: true, default: 3 },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("system_settings");
};
