// Removes the department-wide daily capacity and the per-date booking switch: their admin pages
// (Daily Appointment Capacity, Appointment Availability) and the officer's Department Schedule
// view were removed. Working hours and calendar exceptions remain.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropTable("booking_closures");
  pgm.dropTable("department_capacities");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.createTable("department_capacities", {
    department_id: { type: "text", primaryKey: true, references: "departments", onDelete: "CASCADE" },
    daily_capacity: { type: "integer", notNull: true, check: "daily_capacity >= 1" },
    updated_by: { type: "text" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createTable("booking_closures", {
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "CASCADE" },
    date: { type: "date", notNull: true },
    reason: { type: "text" },
    created_by: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("booking_closures", "booking_closures_pkey", { primaryKey: ["department_id", "date"] });
  pgm.createIndex("booking_closures", "date");
};
