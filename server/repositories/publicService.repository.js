// Data access for "services" (the public service catalog).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/publicService.model.js";
import { containsPattern } from "../utils/pagination.js";

/** Filters: departmentId, search (name or code, case-insensitive), isActive. Sorted by name. */
export async function findAll({ departmentId, search, isActive }) {
  const where = [];
  const params = [];
  if (departmentId) {
    params.push(departmentId);
    where.push(`department_id = $${params.length}`);
  }
  if (search) {
    params.push(containsPattern(search));
    where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`is_active = $${params.length}`);
  }
  const sql = `SELECT * FROM services ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY name`;
  return (await rows(sql, params)).map(fromRow);
}

export async function findById(id) {
  return fromRow(await one("SELECT * FROM services WHERE id = $1", [id]));
}

/** The service with its department's fields (for booking and the slip), or null. */
export async function findWithDepartment(id) {
  const r = await one(
    `SELECT s.id, s.name, s.is_active, s.required_documents, s.department_id,
            d.name AS department_name, d.building_room, d.is_active AS department_active
     FROM services s LEFT JOIN departments d ON d.id = s.department_id WHERE s.id = $1`,
    [id],
  );
  if (!r) return null;
  return {
    id: r.id, name: r.name, active: r.is_active, requiredDocuments: r.required_documents ?? [],
    departmentId: r.department_id, departmentName: r.department_name ?? "", buildingRoom: r.building_room ?? "",
    departmentActive: r.department_active ?? true,
  };
}

export async function exists(id) {
  return Boolean(await one("SELECT 1 FROM services WHERE id = $1", [id]));
}

export async function existsInDepartment(departmentId) {
  return Boolean(await one("SELECT 1 FROM services WHERE department_id = $1 LIMIT 1", [departmentId]));
}

export async function hasAppointments(id) {
  return Boolean(await one("SELECT 1 FROM appointments WHERE service_id = $1 LIMIT 1", [id]));
}

const COLUMNS = [
  "department_id", "code", "name", "description", "duration_minutes", "daily_quota", "fee_etb", "processing_days", "required_documents",
];
const values = (s) => [s.departmentId, s.code, s.name, s.description, s.durationMinutes, s.dailyQuota, s.feeETB, s.processingDays, s.requiredDocuments];

export async function create(s) {
  await query(
    `INSERT INTO services (id, ${COLUMNS.join(", ")}) VALUES ($1, ${COLUMNS.map((_, i) => `$${i + 2}`).join(", ")})`,
    [s.id, ...values(s)],
  );
}

/** Returns false when no service has this id. */
export async function update(id, s) {
  const { rowCount } = await query(
    `UPDATE services SET ${COLUMNS.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...values(s)],
  );
  return rowCount > 0;
}

/** Flips is_active; returns the new value, or null when not found. */
export async function toggleActive(id) {
  const row = await one("UPDATE services SET is_active = NOT is_active, updated_at = now() WHERE id = $1 RETURNING is_active", [id]);
  return row ? row.is_active : null;
}

/** Returns false when no service has this id. Its schedules become department-wide (ON DELETE SET NULL). */
export async function remove(id) {
  const { rowCount } = await query("DELETE FROM services WHERE id = $1", [id]);
  return rowCount > 0;
}

/** Assigns a list of services to a department. */
export async function assignToDepartment(departmentId, serviceIds = []) {
  if (!serviceIds.length) return;
  await query(
    "UPDATE services SET department_id = $1, updated_at = now() WHERE id = ANY($2::text[])",
    [departmentId, serviceIds],
  );
}

/** Unassigns services from a department, optionally preserving excluded IDs. */
export async function unassignFromDepartment(departmentId, excludeServiceIds = []) {
  if (excludeServiceIds.length) {
    await query(
      "UPDATE services SET department_id = NULL, updated_at = now() WHERE department_id = $1 AND NOT (id = ANY($2::text[]))",
      [departmentId, excludeServiceIds],
    );
  } else {
    await query(
      "UPDATE services SET department_id = NULL, updated_at = now() WHERE department_id = $1",
      [departmentId],
    );
  }
}
