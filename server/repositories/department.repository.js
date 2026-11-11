// Data access for "departments" (with officer and service counts).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/department.model.js";

const SELECT_WITH_COUNTS = `
  SELECT d.*,
    (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.role = 'OFFICER') AS officer_count,
    (SELECT COUNT(*)::int FROM services s WHERE s.department_id = d.id) AS service_count
  FROM departments d`;

/** Sorted by name; supports optional boolean or { isActive, departmentId, search }. */
export async function findAll(opts) {
  let isActive = undefined;
  let search = "";
  let departmentId = undefined;
  if (typeof opts === "boolean") {
    isActive = opts;
  } else if (opts && typeof opts === "object") {
    isActive = opts.isActive;
    search = opts.search || "";
    departmentId = opts.departmentId;
  }

  const params = [];
  const where = [];

  if (departmentId && departmentId !== "ALL") {
    params.push(departmentId);
    where.push(`d.id = $${params.length}`);
  }

  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`d.is_active = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    const pIdx = params.length;
    where.push(
      `(d.name ILIKE $${pIdx} OR d.code ILIKE $${pIdx} OR d.building_room ILIKE $${pIdx} OR d.contact_phone ILIKE $${pIdx} OR EXISTS (SELECT 1 FROM services s WHERE s.department_id = d.id AND s.name ILIKE $${pIdx}))`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const list = await rows(`${SELECT_WITH_COUNTS} ${whereClause} ORDER BY d.name, d.id`, params);
  return list.map(fromRow);
}

/** Cursor-paged departments matching search, departmentId & status. */
export async function findPage({ isActive, departmentId, search = "", offset = 0, limit = 3 }) {
  const params = [];
  const where = [];

  if (departmentId && departmentId !== "ALL") {
    params.push(departmentId);
    where.push(`d.id = $${params.length}`);
  }

  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`d.is_active = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    const pIdx = params.length;
    where.push(
      `(d.name ILIKE $${pIdx} OR d.code ILIKE $${pIdx} OR d.building_room ILIKE $${pIdx} OR d.contact_phone ILIKE $${pIdx} OR EXISTS (SELECT 1 FROM services s WHERE s.department_id = d.id AND s.name ILIKE $${pIdx}))`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ total }] = await rows(
    `SELECT COUNT(*)::int AS total FROM departments d ${whereClause}`,
    params
  );

  const queryParams = [...params, offset, limit];
  const items = await rows(
    `${SELECT_WITH_COUNTS} ${whereClause} ORDER BY d.name, d.id OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    queryParams
  );

  return { total, items: items.map(fromRow) };
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
