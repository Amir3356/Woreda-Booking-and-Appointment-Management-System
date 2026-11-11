// The public services citizens book.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("services", {
    id: { type: "text", primaryKey: true },
    // A department with services cannot be deleted.
    department_id: { type: "text", notNull: true, references: "departments", onDelete: "RESTRICT" },
    code: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    description: { type: "text", notNull: true, default: "" },
    duration_minutes: { type: "integer", notNull: true, default: 30, check: "duration_minutes >= 1" },
    daily_quota: { type: "integer", notNull: true, default: 40, check: "daily_quota >= 1" },
    fee_etb: { type: "numeric(12, 2)", notNull: true, default: 0, check: "fee_etb >= 0" },
    processing_days: { type: "text", notNull: true, default: "Same day" },
    required_documents: { type: "text[]", notNull: true, default: "{}" },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("services", "department_id");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("services");
};
