// Ensures departments can be deleted safely while preserving public services (SET NULL) and cascading appointments.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropConstraint("services", "services_department_id_fkey", { ifExists: true });
  pgm.addConstraint("services", "services_department_id_fkey", {
    foreignKeys: {
      columns: "department_id",
      references: "departments(id)",
      onDelete: "SET NULL",
    },
  });

  pgm.dropConstraint("appointments", "appointments_department_id_fkey", { ifExists: true });
  pgm.addConstraint("appointments", "appointments_department_id_fkey", {
    foreignKeys: {
      columns: "department_id",
      references: "departments(id)",
      onDelete: "CASCADE",
    },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("services", "services_department_id_fkey", { ifExists: true });
  pgm.addConstraint("services", "services_department_id_fkey", {
    foreignKeys: {
      columns: "department_id",
      references: "departments(id)",
      onDelete: "RESTRICT",
    },
  });

  pgm.dropConstraint("appointments", "appointments_department_id_fkey", { ifExists: true });
  pgm.addConstraint("appointments", "appointments_department_id_fkey", {
    foreignKeys: {
      columns: "department_id",
      references: "departments(id)",
      onDelete: "RESTRICT",
    },
  });
};
