// Data access for "appointments". Reads join the department and service names.
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/appointment.model.js";
import { containsPattern } from "../utils/pagination.js";

const SELECT_WITH_NAMES = `
  SELECT a.*, d.name AS department_name, s.name AS service_name
  FROM appointments a
  JOIN departments d ON d.id = a.department_id
  JOIN services s ON s.id = a.service_id`;

const HOLDS_PLACE = "status NOT IN ('CANCELLED', 'REJECTED')";

export async function findById(id, client) {
  return fromRow(await one(`${SELECT_WITH_NAMES} WHERE a.id = $1`, [id], client));
}

/** Locks the appointment row until the transaction ends; returns it, or null. */
export async function findByIdForUpdate(id, client) {
  const row = await one("SELECT id FROM appointments WHERE id = $1 FOR UPDATE", [id], client);
  return row ? findById(id, client) : null;
}

export async function create(a, client) {
  await query(
    `INSERT INTO appointments (id, reference_number, citizen_id, citizen_name, citizen_phone,
       department_id, service_id, date, time_slot, status, citizen_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [a.id, a.referenceNumber, a.citizenId, a.citizenName, a.citizenPhone,
      a.departmentId, a.serviceId, a.date, a.timeSlot, a.status, a.citizenNotes],
    client,
  );
}

/** Places taken on a service's day, and in one of its time slots (excluding excludeId). */
export async function countTaken({ serviceId, date, timeSlot, excludeId = null }, client) {
  return one(
    `SELECT COUNT(*)::int AS day,
            COUNT(*) FILTER (WHERE time_slot = $3)::int AS slot
     FROM appointments
     WHERE service_id = $1 AND date = $2 AND ${HOLDS_PLACE} AND ($4::text IS NULL OR id <> $4)`,
    [serviceId, date, timeSlot, excludeId],
    client,
  );
}

/** Places taken in a whole department on date (excluding excludeId): the department daily capacity. */
export async function countDepartmentDay({ departmentId, date, excludeId = null }, client) {
  const r = await one(
    `SELECT COUNT(*)::int AS n FROM appointments
     WHERE department_id = $1 AND date = $2 AND ${HOLDS_PLACE} AND ($3::text IS NULL OR id <> $3)`,
    [departmentId, date, excludeId],
    client,
  );
  return r.n;
}

/** Places taken per department and date in [from, to]: { "<departmentId>|<date>": n }. */
export async function countByDepartmentDay({ from, to, departmentIds }) {
  const params = [from, to];
  let filter = "";
  if (departmentIds?.length) {
    params.push(departmentIds);
    filter = "AND department_id = ANY($3)";
  }
  const list = await rows(
    `SELECT department_id, date, COUNT(*)::int AS n FROM appointments
     WHERE date BETWEEN $1 AND $2 AND ${HOLDS_PLACE} ${filter} GROUP BY department_id, date`,
    params,
  );
  return Object.fromEntries(list.map((r) => [`${r.department_id}|${r.date}`, r.n]));
}

/** Places taken per date for one service in [from, to]: { "<date>": n }. */
export async function countServiceDays({ serviceId, from, to }) {
  const list = await rows(
    `SELECT date, COUNT(*)::int AS n FROM appointments
     WHERE service_id = $1 AND date BETWEEN $2 AND $3 AND ${HOLDS_PLACE} GROUP BY date`,
    [serviceId, from, to],
  );
  return Object.fromEntries(list.map((r) => [r.date, r.n]));
}

/**
 * Upcoming appointments that still need to be served on [from, to] (optionally for some
 * departments): what a schedule change would affect. Never changed by schedule edits.
 */
export async function countOutstanding({ from, to, departmentIds }) {
  const params = [from, to];
  let filter = "";
  if (departmentIds?.length) {
    params.push(departmentIds);
    filter = "AND a.department_id = ANY($3)";
  }
  return rows(
    `SELECT a.department_id, d.name AS department_name, a.status, COUNT(*)::int AS n
     FROM appointments a JOIN departments d ON d.id = a.department_id
     WHERE a.date BETWEEN $1 AND $2 AND a.status IN ('PENDING', 'APPROVED', 'CHECKED_IN', 'IN_PROGRESS') ${filter}
     GROUP BY a.department_id, d.name, a.status ORDER BY d.name`,
    params,
  );
}

/** Active bookings per time slot for a service on date: {"09:00 AM": n}. */
export async function countBySlot(serviceId, date) {
  const list = await rows(
    `SELECT time_slot, COUNT(*)::int AS n FROM appointments
     WHERE service_id = $1 AND date = $2 AND ${HOLDS_PLACE} GROUP BY time_slot`,
    [serviceId, date],
  );
  return Object.fromEntries(list.map((r) => [r.time_slot, r.n]));
}

/** Latest appointment whose reference number or citizen phone equals ref. */
export async function findLatestByReferenceOrPhone(ref) {
  return fromRow(await one(
    `${SELECT_WITH_NAMES} WHERE a.reference_number = $1 OR a.citizen_phone = $1 ORDER BY a.created_at DESC LIMIT 1`,
    [ref],
  ));
}

/** A citizen's appointments, newest date first. statuses: list or undefined; search: reference or service name. */
export async function findByCitizen({ citizenId, fromDate, statuses, search }) {
  const params = [citizenId];
  const where = ["a.citizen_id = $1"];
  if (fromDate !== undefined) {
    params.push(fromDate);
    where.push(`a.date >= $${params.length}`);
  }
  if (statuses !== undefined) {
    params.push(statuses);
    where.push(`a.status = ANY($${params.length})`);
  }
  if (search) {
    params.push(containsPattern(search));
    where.push(`(a.reference_number ILIKE $${params.length} OR s.name ILIKE $${params.length})`);
  }
  const list = await rows(`${SELECT_WITH_NAMES} WHERE ${where.join(" AND ")} ORDER BY a.date DESC, a.created_at DESC`, params);
  return list.map(fromRow);
}

/** One page of the registry plus the total. date: exact date; afterDate: later dates; search: name, reference or phone. */
export async function findPage({ departmentId, status, date, afterDate, search }, { page, limit }) {
  const params = [];
  const where = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (departmentId) add("a.department_id = ?", departmentId);
  if (status) add("a.status = ?", status);
  if (date !== undefined) add("a.date = ?", date);
  else if (afterDate !== undefined) add("a.date > ?", afterDate);
  if (search) add("(a.citizen_name ILIKE ? OR a.reference_number ILIKE ? OR a.citizen_phone ILIKE ?)", containsPattern(search));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ total }] = await rows(
    `SELECT COUNT(*)::int AS total FROM appointments a ${clause}`, params,
  );
  const list = await rows(
    `${SELECT_WITH_NAMES} ${clause} ORDER BY a.date, a.time_slot, a.id OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, (page - 1) * limit, limit],
  );
  return { items: list.map(fromRow), total };
}

/** PENDING -> APPROVED/REJECTED; false when the appointment is no longer PENDING. */
export async function review(id, { status, officerNotes, rejectionReason, officerId }) {
  const { rowCount } = await query(
    `UPDATE appointments SET status = $2, officer_notes = $3, rejection_reason = $4, responsible_officer_id = $5, updated_at = now()
     WHERE id = $1 AND status = 'PENDING'`,
    [id, status, officerNotes, rejectionReason, officerId],
  );
  return rowCount > 0;
}

/** Moves to a new date/time and resets the status to APPROVED. */
export async function reschedule(id, date, timeSlot, client) {
  await query(
    "UPDATE appointments SET date = $2, time_slot = $3, status = 'APPROVED', updated_at = now() WHERE id = $1",
    [id, date, timeSlot],
    client,
  );
}

/** Sets CANCELLED when the status is one of allowed; false otherwise. */
export async function cancel(id, allowed) {
  const { rowCount } = await query(
    "UPDATE appointments SET status = 'CANCELLED', updated_at = now() WHERE id = $1 AND status = ANY($2)",
    [id, allowed],
  );
  return rowCount > 0;
}

/** APPROVED -> CHECKED_IN with the token number; false when the appointment is no longer APPROVED. */
export async function markCheckedIn(id, tokenNumber, client) {
  const { rowCount } = await query(
    `UPDATE appointments SET status = 'CHECKED_IN', token_number = $2, checked_in_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'APPROVED'`,
    [id, tokenNumber],
    client,
  );
  return rowCount > 0;
}

/** Sets IN_PROGRESS; returns the citizen's name ("" when unknown). */
export async function markInProgress(id, client) {
  const row = await one(
    "UPDATE appointments SET status = 'IN_PROGRESS', updated_at = now() WHERE id = $1 RETURNING citizen_name",
    [id],
    client,
  );
  return row?.citizen_name ?? "";
}

/** Sets COMPLETED (with completed_at) or NO_SHOW. */
export async function markFinal(id, status, client) {
  await query(
    `UPDATE appointments SET status = $2, updated_at = now(),
       completed_at = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE completed_at END
     WHERE id = $1`,
    [id, status],
    client,
  );
}

/** {total, completed, noShow, cancelled} for appointment dates in [from, to). */
export async function countOutcomes({ from, to, departmentId }) {
  return one(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_show,
            COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
     FROM appointments
     WHERE date >= $1 AND date < $2 AND ($3::text IS NULL OR department_id = $3)`,
    [from, to, departmentId || null],
  );
}
