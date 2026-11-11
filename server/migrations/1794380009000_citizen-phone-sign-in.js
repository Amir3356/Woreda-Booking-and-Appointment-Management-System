// Citizens register and sign in with their phone number: email becomes optional, and a phone
// number (when set) belongs to one account only. Staff accounts keep phone '' and sign in by email.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.alterColumn("users", "email", { notNull: false });
  pgm.sql("CREATE UNIQUE INDEX users_phone_key ON users (phone) WHERE phone <> ''");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql("DROP INDEX users_phone_key");
  // Accounts created without an email get a placeholder so the column can be required again.
  pgm.sql("UPDATE users SET email = id || '@no-email.invalid' WHERE email IS NULL");
  pgm.alterColumn("users", "email", { notNull: true });
};
