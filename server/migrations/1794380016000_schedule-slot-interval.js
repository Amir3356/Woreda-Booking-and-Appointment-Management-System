/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("schedules", {
    slot_interval_minutes: { type: "integer", notNull: true, default: 30 },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropColumns("schedules", ["slot_interval_minutes"]);
};
