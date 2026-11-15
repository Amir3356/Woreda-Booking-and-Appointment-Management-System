// Before/after snapshots on audit entries: the appointment's status, date and time slot just before
// and just after the action (Admin > Audit Logs shows them side by side). Null "before" = the action
// created the appointment. Older rows keep null snapshots; the API derives them from from_status,
// to_status and the stored date and time.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("audit_logs", {
    before_snapshot: { type: "jsonb" },
    after_snapshot: { type: "jsonb" },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropColumns("audit_logs", ["before_snapshot", "after_snapshot"]);
};
