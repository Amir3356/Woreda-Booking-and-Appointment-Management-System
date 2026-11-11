// Citizen bookings and their lifecycle.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("appointments", {
    id: { type: "text", primaryKey: true },
    reference_number: { type: "text", notNull: true, unique: true },
    citizen_id: { type: "text", notNull: true },
    citizen_name: { type: "text", notNull: true },
    citizen_phone: { type: "text", notNull: true },
    citizen_email: { type: "text" },
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "RESTRICT" },
    // A service with appointments cannot be deleted (deactivate it instead).
    service_id: { type: "text", notNull: true, references: "services", onDelete: "RESTRICT" },
    date: { type: "date", notNull: true },
    time_slot: { type: "text", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "PENDING",
      check: "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')",
    },
    token_number: { type: "text" },
    citizen_notes: { type: "text" },
    officer_notes: { type: "text" },
    rejection_reason: { type: "text" },
    responsible_officer_id: { type: "text" },
    checked_in_at: { type: "timestamptz" },
    completed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("appointments", ["service_id", "date", "time_slot"]);
  pgm.createIndex("appointments", ["citizen_id", { name: "created_at", sort: "DESC" }]);
  pgm.createIndex("appointments", ["department_id", "date"]);
  pgm.createIndex("appointments", "citizen_phone");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("appointments");
};
