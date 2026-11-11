// Data access for "users" (citizen profiles and staff accounts).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/user.model.js";

const SELECT_WITH_DEPARTMENT = `
  SELECT u.*, d.name AS department_name
  FROM users u LEFT JOIN departments d ON d.id = u.department_id`;

/** Emails compare case-insensitively. */
export async function existsByEmail(email) {
  return Boolean(await one("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [email]));
}

export async function existsByNationalId(nationalId) {
  return Boolean(await one("SELECT 1 FROM users WHERE national_id = $1", [nationalId]));
}

export async function exists(id) {
  return Boolean(await one("SELECT 1 FROM users WHERE id = $1", [id]));
}

/** Inserts a user and returns it. */
export async function create(u) {
  const row = await one(
    `INSERT INTO users (id, full_name, email, phone, password_hash, national_id, role, department_id, counter_number, address, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [u.id, u.fullName, u.email, u.phone ?? "", u.passwordHash, u.nationalId, u.role, u.departmentId ?? null,
      u.counterNumber ?? null, u.address ?? null, u.isActive ?? true],
  );
  return fromRow(row);
}

/** Case-insensitive email lookup with departmentName (includes passwordHash). */
export async function findByEmail(email) {
  return fromRow(await one(`${SELECT_WITH_DEPARTMENT} WHERE LOWER(u.email) = LOWER($1)`, [email]));
}

export async function findById(id) {
  return fromRow(await one(`${SELECT_WITH_DEPARTMENT} WHERE u.id = $1`, [id]));
}

export async function findCitizen(id) {
  return fromRow(await one("SELECT * FROM users WHERE id = $1 AND role = 'CITIZEN'", [id]));
}

/** Returns false when no citizen has this id. */
export async function updateCitizen(id, f) {
  const { rowCount } = await query(
    `UPDATE users SET full_name = $2, phone = $3, email = $4, national_id = $5, address = $6, updated_at = now()
     WHERE id = $1 AND role = 'CITIZEN'`,
    [id, f.fullName, f.phone, f.email, f.nationalId, f.address],
  );
  return rowCount > 0;
}

/** Staff (non-citizen) accounts matching search on name/email (ILIKE): {total, items} for one page, newest first. */
export async function findStaffPage(search, offset, limit) {
  const params = [];
  let where = "u.role <> 'CITIZEN'";
  if (search !== "") {
    params.push(`%${search}%`);
    where += ` AND (u.full_name ILIKE $1 OR u.email ILIKE $1)`;
  }
  const [{ total }] = await rows(`SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`, params);
  const items = await rows(
    `${SELECT_WITH_DEPARTMENT} WHERE ${where} ORDER BY u.created_at DESC, u.id
     OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, offset, limit],
  );
  return { total, items: items.map(fromRow) };
}

/** Flips is_active of a staff account; returns the new value, or null when not found. */
export async function toggleStaffActive(id) {
  const row = await one(
    "UPDATE users SET is_active = NOT is_active, updated_at = now() WHERE id = $1 AND role <> 'CITIZEN' RETURNING is_active",
    [id],
  );
  return row ? row.is_active : null;
}

/** Returns false when no staff account has this id. */
export async function removeStaff(id) {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1 AND role <> 'CITIZEN'", [id]);
  return rowCount > 0;
}

/** The officer's desk counter number (null when unset or unknown). */
export async function findCounterNumber(id, client) {
  const row = await one("SELECT counter_number FROM users WHERE id = $1", [id], client);
  return row?.counter_number ?? null;
}
