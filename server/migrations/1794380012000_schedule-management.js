// Admin > Schedule Management: department daily capacities, per-date booking switches and
// calendar exceptions (holidays, non-working days, blocked dates, exceptional working days).
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  // Maximum appointments per day for a whole department (all its services together).
  pgm.createTable("department_capacities", {
    department_id: { type: "text", primaryKey: true, references: "departments", onDelete: "CASCADE" },
    daily_capacity: { type: "integer", notNull: true, check: "daily_capacity >= 1" },
    updated_by: { type: "text" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // Appointment Availability: a row closes online booking for one department on one date.
  pgm.createTable("booking_closures", {
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "CASCADE" },
    date: { type: "date", notNull: true },
    reason: { type: "text" },
    created_by: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("booking_closures", "booking_closures_pkey", { primaryKey: ["department_id", "date"] });
  pgm.createIndex("booking_closures", "date");

  // Calendar Exceptions: dated overrides of the weekly operating hours.
  pgm.createTable("calendar_exceptions", {
    id: { type: "text", primaryKey: true },
    type: {
      type: "text",
      notNull: true,
      check: "type IN ('PUBLIC_HOLIDAY', 'NON_WORKING_DAY', 'BLOCKED', 'WORKING_DAY')",
    },
    title: { type: "text", notNull: true },
    description: { type: "text" },
    start_date: { type: "date", notNull: true },
    end_date: { type: "date", notNull: true },
    // ALL = every department; DEPARTMENT / DEPARTMENTS = the rows of calendar_exception_departments.
    scope: { type: "text", notNull: true, default: "ALL", check: "scope IN ('ALL', 'DEPARTMENT', 'DEPARTMENTS')" },
    // Exceptional working days only: their own hours and per-department daily capacity.
    opening_time: { type: "time" },
    closing_time: { type: "time" },
    daily_capacity: { type: "integer", check: "daily_capacity IS NULL OR daily_capacity >= 1" },
    created_by: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("calendar_exceptions", "calendar_exceptions_range_check", { check: "end_date >= start_date" });
  pgm.addConstraint("calendar_exceptions", "calendar_exceptions_working_day_check", {
    check: `type <> 'WORKING_DAY' OR (opening_time IS NOT NULL AND closing_time IS NOT NULL
            AND closing_time > opening_time AND daily_capacity IS NOT NULL)`,
  });
  pgm.createIndex("calendar_exceptions", ["start_date", "end_date"]);

  pgm.createTable("calendar_exception_departments", {
    exception_id: { type: "text", notNull: true, references: "calendar_exceptions", onDelete: "CASCADE" },
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "CASCADE" },
  });
  pgm.addConstraint("calendar_exception_departments", "calendar_exception_departments_pkey", {
    primaryKey: ["exception_id", "department_id"],
  });
  pgm.createIndex("calendar_exception_departments", "department_id");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("calendar_exception_departments");
  pgm.dropTable("calendar_exceptions");
  pgm.dropTable("booking_closures");
  pgm.dropTable("department_capacities");
};
