// Short-lived auth state: signed-out tokens and failed sign-in counters.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  // Signed-out tokens (by JWT id) until they would have expired anyway.
  pgm.createTable("revoked_tokens", {
    jti: { type: "text", primaryKey: true },
    expires_at: { type: "timestamptz", notNull: true },
  });
  // Failed sign-ins per lower-cased email; the window restarts with each failure.
  pgm.createTable("login_failures", {
    email: { type: "text", primaryKey: true },
    failures: { type: "integer", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("login_failures");
  pgm.dropTable("revoked_tokens");
};
