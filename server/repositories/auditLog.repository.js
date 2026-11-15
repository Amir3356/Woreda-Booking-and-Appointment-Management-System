// Data access for "audit_logs".
import { query, rows } from "../config/database.js";
import { fromRow } from "../models/auditLog.model.js";
import { containsPattern } from "../utils/pagination.js";

export async function create(e) {
  const [row] = await rows(
    `INSERT INTO audit_logs (id, at, action, from_status, to_status, actor_id, actor_name, actor_role, appointment_id,
       reference_number, citizen_name, department_id, department_name, service_name, appointment_date, time_slot, reason,
       before_snapshot, after_snapshot)
     VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [e.id, e.action, e.fromStatus, e.toStatus, e.actorId, e.actorName, e.actorRole, e.appointmentId, e.referenceNumber,
      e.citizenName, e.departmentId, e.departmentName, e.serviceName, e.appointmentDate, e.timeSlot, e.reason,
      e.beforeSnapshot ? JSON.stringify(e.beforeSnapshot) : null, e.afterSnapshot ? JSON.stringify(e.afterSnapshot) : null],
  );
  return fromRow(row);
}

/** Exact timestamp text (UTC, microseconds) used in cursors. */
const AT_KEY = `to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** WHERE conditions and params for the filters: action, departmentId, search (officer, citizen, reference, service, department). */
function filterClause({ action, departmentId, search }) {
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
  return { params, where };
}

const whereSql = (conditions) => (conditions.length ? `WHERE ${conditions.join(" AND ")}` : "");

/**
 * One page by keyset, newest first (at DESC, id DESC). cursor: null for the first page, or
 * { direction: "a" (older than the row) | "b" (newer than the row), at, id }.
 * Returns the rows (each with its cursor key), how many entries come before the page, and the
 * filtered total.
 */
export async function findKeysetPage(filters, { cursor, pageSize }) {
  const { params: filterParams, where: filterWhere } = filterClause(filters);

  const params = [...filterParams];
  const where = [...filterWhere];
  let order = "at DESC, id DESC";
  if (cursor) {
    params.push(cursor.at, cursor.id);
    const pAt = `$${params.length - 1}::timestamptz`;
    const pId = `$${params.length}`;
    if (cursor.direction === "a") {
      where.push(`(at, id) < (${pAt}, ${pId})`);
    } else {
      // The rows just above the cursor: read upwards, then flip back to newest first.
      where.push(`(at, id) > (${pAt}, ${pId})`);
      order = "at ASC, id ASC";
    }
  }
  params.push(pageSize);
  const list = await rows(
    `SELECT *, ${AT_KEY} AS at_key FROM audit_logs ${whereSql(where)} ORDER BY ${order} LIMIT $${params.length}`,
    params,
  );
  if (cursor?.direction === "b") list.reverse();

  const [{ total }] = await rows(`SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql(filterWhere)}`, filterParams);
  let before = 0;
  if (list.length) {
    const n = filterParams.length;
    const [{ count }] = await rows(
      `SELECT COUNT(*)::int AS count FROM audit_logs ${whereSql([...filterWhere, `(at, id) > ($${n + 1}::timestamptz, $${n + 2})`])}`,
      [...filterParams, list[0].at_key, list[0].id],
    );
    before = count;
  }
  return { items: list.map((r) => ({ ...fromRow(r), cursorKey: { at: r.at_key, id: r.id } })), before, total };
}
