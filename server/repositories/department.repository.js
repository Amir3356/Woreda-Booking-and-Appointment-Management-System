// Data access for "departments" (with officer and service counts).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/department.model.js";

const SELECT_WITH_COUNTS = `
  SELECT d.*,
    (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role = 'OFFICER') AS officer_count,
    (SELECT COUNT(*)::int FROM services s WHERE s.department_id = d.id) AS service_count
  FROM departments d`;

/** Sorted by name; isActive undefined = all. */
export async function findAll(isActive) {
  const list = isActive === undefined
    ? await rows(`${SELECT_WITH_COUNTS} ORDER BY d.name`)
    : await rows(`${SELECT_WITH_COUNTS} WHERE d.is_active = $1 ORDER BY d.name`, [isActive]);
  return list.map(fromRow);
}

export async function findById(id) {
  return fromRow(await one(`${SELECT_WITH_COUNTS} WHERE d.id = $1`, [id]));
}

export async function exists(id) {
  return Boolean(await one("SELECT 1 FROM departments WHERE id = $1", [id]));
}

export async function create(d) {
  await query(
    `INSERT INTO departments (id, code, name, description, building_room, contact_phone)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [d.id, d.code, d.name, d.description, d.buildingRoom, d.contactPhone],
  );
}

/** Returns false when no department has this id. */
export async function update(id, d) {
  const { rowCount } = await query(
    `UPDATE departments SET code = $2, name = $3, description = $4, building_room = $5, contact_phone = $6, updated_at = now()
     WHERE id = $1`,
    [id, d.code, d.name, d.description, d.buildingRoom, d.contactPhone],
  );
  return rowCount > 0;
}

/** Flips is_active; returns the new value, or null when not found. */
export async function toggleActive(id) {
  const row = await one("UPDATE departments SET is_active = NOT is_active, updated_at = now() WHERE id = $1 RETURNING is_active", [id]);
  return row ? row.is_active : null;
}

/** Returns false when no department has this id. Officers are detached by the foreign key (ON DELETE SET NULL). */
export async function remove(id) {
  const { rowCount } = await query("DELETE FROM departments WHERE id = $1", [id]);
  return rowCount > 0;
}

/** The department's code, or null when the department does not exist. */
export async function findCode(id, client) {
  const row = await one("SELECT code FROM departments WHERE id = $1", [id], client);
  return row ? row.code : null;
}
