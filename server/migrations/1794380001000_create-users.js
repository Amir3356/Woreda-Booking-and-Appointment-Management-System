// Citizens, department officers and administrators.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("users", {
    id: { type: "text", primaryKey: true },
    full_name: { type: "text", notNull: true },
    email: { type: "text", notNull: true },
    phone: { type: "text", notNull: true, default: "" },
    password_hash: { type: "text", notNull: true },
    national_id: { type: "text", notNull: true, unique: true },
    role: { type: "text", notNull: true, default: "CITIZEN", check: "role IN ('CITIZEN', 'OFFICER', 'ADMIN')" },
    // Deleting a department detaches its officers.
    department_id: { type: "text", references: "departments", onDelete: "SET NULL" },
    counter_number: { type: "integer", check: "counter_number IS NULL OR counter_number > 0" },
    address: { type: "text" },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  // Emails are unique ignoring case (sign-in compares them case-insensitively).
  pgm.sql("CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email))");
  pgm.createIndex("users", ["role", "department_id"]);
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("users");
};
