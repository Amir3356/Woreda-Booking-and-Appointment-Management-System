// Data access for "audit_logs".
import { query, rows } from "../config/database.js";
import { fromRow } from "../models/auditLog.model.js";
import { containsPattern } from "../utils/pagination.js";

export async function create(e) {
  const [row] = await rows(
    `INSERT INTO audit_logs (id, at, action, from_status, to_status, actor_id, actor_name, actor_role, appointment_id,
       reference_number, citizen_name, department_id, department_name, service_name, appointment_date, time_slot, reason)
     VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [e.id, e.action, e.fromStatus, e.toStatus, e.actorId, e.actorName, e.actorRole, e.appointmentId, e.referenceNumber,
      e.citizenName, e.departmentId, e.departmentName, e.serviceName, e.appointmentDate, e.timeSlot, e.reason],
  );
  return fromRow(row);
}

/** Newest first; filters: action, departmentId, search (officer, citizen, reference, service, department). */
export async function findPage({ action, departmentId, search }, { page, limit }) {
  const params = [];
  const where = [];
  if (action) {
    params.push(action);
    where.push(`action = $${params.length}`);
  }
  if (departmentId) {
    params.push(departmentId);
    where.push(`department_id = $${params.length}`);
  }
  if (search) {
    params.push(containsPattern(search));
    const p = `$${params.length}`;
    where.push(`(actor_name ILIKE ${p} OR citizen_name ILIKE ${p} OR reference_number ILIKE ${p} OR service_name ILIKE ${p} OR department_name ILIKE ${p})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ total }] = await rows(`SELECT COUNT(*)::int AS total FROM audit_logs ${clause}`, params);
  const list = await rows(
    `SELECT * FROM audit_logs ${clause} ORDER BY at DESC, id DESC OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, (page - 1) * limit, limit],
  );
  return { items: list.map(fromRow), total };
}
