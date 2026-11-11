// Operating hours per department, optionally per service (Admin > Schedule Management).
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("schedules", {
    id: { type: "text", primaryKey: true },
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "CASCADE" },
    // NULL = department-wide; deleting a service turns its schedules department-wide.
    service_id: { type: "text", references: "services", onDelete: "SET NULL" },
    working_days: { type: "text[]", notNull: true, default: "{Mon,Tue,Wed,Thu,Fri}" },
    opening_time: { type: "time", notNull: true, default: "08:30" },
    closing_time: { type: "time", notNull: true, default: "17:30" },
    daily_capacity: { type: "integer", notNull: true, default: 40, check: "daily_capacity >= 1" },
    effective_start_date: { type: "date", notNull: true },
    effective_end_date: { type: "date" },
    status: { type: "text", notNull: true, default: "ACTIVE", check: "status IN ('ACTIVE', 'INACTIVE')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("schedules", "department_id");
  pgm.createIndex("schedules", ["service_id", "status"]);
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("schedules");
};
