// Each service's own Daily Appointment Capacity within a working-hours schedule. A service with
// no row here uses the schedule's daily_capacity as its default.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("schedule_service_capacities", {
    schedule_id: { type: "text", notNull: true, references: "schedules", onDelete: "CASCADE" },
    service_id: { type: "text", notNull: true, references: "services", onDelete: "CASCADE" },
    daily_capacity: { type: "integer", notNull: true, check: "daily_capacity >= 1" },
  });
  pgm.addConstraint("schedule_service_capacities", "schedule_service_capacities_pkey", { primaryKey: ["schedule_id", "service_id"] });
  pgm.createIndex("schedule_service_capacities", "service_id");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("schedule_service_capacities");
};
