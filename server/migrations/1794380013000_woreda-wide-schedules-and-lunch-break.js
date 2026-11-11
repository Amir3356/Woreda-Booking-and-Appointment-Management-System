// Working hours shared by every department (department_id NULL = all departments of the Woreda)
// and a configurable lunch break per schedule (no bookings between lunch_start and lunch_end).
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.alterColumn("schedules", "department_id", { notNull: false });
  pgm.addColumns("schedules", {
    lunch_start: { type: "time" },
    lunch_end: { type: "time" },
  });
  pgm.addConstraint("schedules", "schedules_lunch_check", {
    check: `(lunch_start IS NULL AND lunch_end IS NULL)
            OR (lunch_start IS NOT NULL AND lunch_end IS NOT NULL AND lunch_end > lunch_start)`,
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("schedules", "schedules_lunch_check");
  pgm.dropColumns("schedules", ["lunch_start", "lunch_end"]);
  // Woreda-wide schedules have no department to fall back to.
  pgm.sql("DELETE FROM schedules WHERE department_id IS NULL");
  pgm.alterColumn("schedules", "department_id", { notNull: true });
};
