// Allows services to exist independently of a department before being assigned in Department Management.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.alterColumn("services", "department_id", { notNull: false });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.alterColumn("services", "department_id", { notNull: true });
};
