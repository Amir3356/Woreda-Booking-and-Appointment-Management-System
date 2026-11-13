// Appointment decisions (Admin > Audit Trail). Rows are only ever added.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("audit_logs", {
    id: { type: "text", primaryKey: true },
    at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    action: { type: "text", notNull: true, check: "action IN ('BOOKED', 'APPROVED', 'REJECTED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED')" },
    from_status: { type: "text" },
    to_status: { type: "text", notNull: true },
    actor_id: { type: "text" },
    actor_name: { type: "text", notNull: true, default: "" },
    actor_role: { type: "text", notNull: true, default: "" },
    appointment_id: { type: "text", notNull: true },
    reference_number: { type: "text", notNull: true, default: "" },
    citizen_name: { type: "text", notNull: true, default: "" },
    department_id: { type: "text" },
    department_name: { type: "text", notNull: true, default: "" },
    service_name: { type: "text", notNull: true, default: "" },
    appointment_date: { type: "text", notNull: true, default: "" },
    time_slot: { type: "text", notNull: true, default: "" },
    reason: { type: "text" },
  });
  pgm.createIndex("audit_logs", [{ name: "at", sort: "DESC" }]);
  pgm.createIndex("audit_logs", ["action", { name: "at", sort: "DESC" }]);
  pgm.createIndex("audit_logs", ["department_id", { name: "at", sort: "DESC" }]);
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("audit_logs");
};
