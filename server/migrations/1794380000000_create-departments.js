// Departments of the Woreda administration.
/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("departments", {
    id: { type: "text", primaryKey: true },
    code: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    description: { type: "text", notNull: true, default: "" },
    building_room: { type: "text", notNull: true },
    contact_phone: { type: "text", notNull: true },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("departments");
};
