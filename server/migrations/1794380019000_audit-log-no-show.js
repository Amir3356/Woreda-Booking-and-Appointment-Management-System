// The desk queue records a "No-show" decision in the audit trail, but the original check on
// audit_logs.action did not allow NO_SHOW, so those entries were rejected and silently lost.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropConstraint("audit_logs", "audit_logs_action_check", { ifExists: true });
  pgm.addConstraint("audit_logs", "audit_logs_action_check", {
    check: "action IN ('BOOKED', 'APPROVED', 'REJECTED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW')",
  });
};

/**
 * Restores the original list. NOT VALID keeps any NO_SHOW rows already recorded (audit rows are
 * never deleted); only new rows are checked.
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("audit_logs", "audit_logs_action_check", { ifExists: true });
  pgm.sql(
    "ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check " +
      "CHECK (action IN ('BOOKED', 'APPROVED', 'REJECTED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED')) NOT VALID",
  );
};
