/**
 * Allows 0 (zero) as a valid daily appointment capacity (e.g. to pause bookings or configure zero capacity for a service).
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropConstraint("schedule_service_capacities", "schedule_service_capacities_daily_capacity_check", { ifExists: true });
  pgm.addConstraint("schedule_service_capacities", "schedule_service_capacities_daily_capacity_check", {
    check: "daily_capacity >= 0",
  });

  pgm.dropConstraint("schedules", "schedules_daily_capacity_check", { ifExists: true });
  pgm.addConstraint("schedules", "schedules_daily_capacity_check", {
    check: "daily_capacity >= 0",
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("schedule_service_capacities", "schedule_service_capacities_daily_capacity_check", { ifExists: true });
  pgm.addConstraint("schedule_service_capacities", "schedule_service_capacities_daily_capacity_check", {
    check: "daily_capacity >= 1",
  });

  pgm.dropConstraint("schedules", "schedules_daily_capacity_check", { ifExists: true });
  pgm.addConstraint("schedules", "schedules_daily_capacity_check", {
    check: "daily_capacity >= 1",
  });
};
