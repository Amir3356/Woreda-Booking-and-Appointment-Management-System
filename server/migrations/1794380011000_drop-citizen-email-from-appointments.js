// Drops the unused citizen_email attribute from the appointments entity,
// since citizen authentication and communication are strictly phone-based.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropColumn("appointments", "citizen_email");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.addColumn("appointments", {
    citizen_email: { type: "text" },
  });
};

