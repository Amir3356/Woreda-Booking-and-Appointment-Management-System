// Seed data: the central administrator (credentials from SEED_ADMIN_* in server/.env) and the
// default system settings. Applied by `npm run seed`; existing rows are left untouched.
import bcrypt from "bcryptjs";
import { config } from "../src/config/index.js";

const ADMIN_ID = "usr-admin";

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const up = async (pgm) => {
  const admin = config.seedAdmin;
  const passwordHash = await bcrypt.hash(admin.password, 10);
  // Parameterized queries, run inside the seed's transaction.
  await pgm.db.query(
    `INSERT INTO users (id, full_name, email, phone, password_hash, national_id, role, is_active)
     SELECT $1, $2, $3, $4, $5, 'ET-ADM-9901', 'ADMIN', TRUE
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER($3))
     ON CONFLICT DO NOTHING`,
    [ADMIN_ID, admin.fullName, admin.email, admin.phone, passwordHash],
  );
  await pgm.db.query("INSERT INTO system_settings (id) VALUES ('primary') ON CONFLICT (id) DO NOTHING");
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 */
export const down = async (pgm) => {
  await pgm.db.query("DELETE FROM users WHERE id = $1", [ADMIN_ID]);
  await pgm.db.query("DELETE FROM system_settings WHERE id = 'primary'");
};
