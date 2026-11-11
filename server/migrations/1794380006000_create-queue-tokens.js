// The desk queue: one token per checked-in appointment.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("queue_tokens", {
    id: { type: "text", primaryKey: true },
    appointment_id: { type: "text", notNull: true, unique: true, references: "appointments", onDelete: "CASCADE" },
    token_number: { type: "text", notNull: true },
    department_id: { type: "text", notNull: true },
    counter_number: { type: "integer", notNull: true, default: 1 },
    officer_id: { type: "text" },
    status: { type: "text", notNull: true, default: "WAITING", check: "status IN ('WAITING', 'SERVING', 'COMPLETED', 'NO_SHOW')" },
    checked_in_time: { type: "time", notNull: true },
    called_time: { type: "time" },
    estimated_minutes_remaining: { type: "integer", notNull: true, default: 15 },
    queue_date: { type: "date", notNull: true },
    // clock_timestamp(): check-ins in one transaction still get distinct, ordered times.
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("clock_timestamp()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("queue_tokens", ["department_id", "queue_date", "status", "created_at"]);
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("queue_tokens");
};
