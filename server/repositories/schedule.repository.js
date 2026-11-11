// Data access for "schedules", joined with department and service names.
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/schedule.model.js";

const SELECT_WITH_NAMES = `
  SELECT sc.*, d.name AS department_name, s.name AS service_name
  FROM schedules sc
  JOIN departments d ON d.id = sc.department_id
  LEFT JOIN services s ON s.id = sc.service_id`;

/** All schedules, ordered by department name, then newest effective start first. */
export async function findAll() {
  return (await rows(`${SELECT_WITH_NAMES} ORDER BY d.name, sc.effective_start_date DESC`)).map(fromRow);
}

export async function findById(id) {
  return fromRow(await one(`${SELECT_WITH_NAMES} WHERE sc.id = $1`, [id]));
}

/** ACTIVE schedules whose effective period has not ended before date (the citizen booking page). */
export async function findBookable(date) {
  const list = await rows(
    `${SELECT_WITH_NAMES}
     WHERE sc.status = 'ACTIVE' AND (sc.effective_end_date IS NULL OR sc.effective_end_date >= $1)
     ORDER BY d.name, sc.effective_start_date`,
    [date],
  );
  return list.map(fromRow);
}

/**
 * The ACTIVE schedule effective on date for the service itself or, when departmentId is given,
 * department-wide (service_id NULL) for that department. A service-specific schedule wins. Null if none.
 */
export async function findActive(serviceId, departmentId, date, client) {
  return fromRow(await one(
    `${SELECT_WITH_NAMES}
     WHERE sc.status = 'ACTIVE'
       AND (sc.service_id = $1 OR ($2::text IS NOT NULL AND sc.service_id IS NULL AND sc.department_id = $2))
       AND sc.effective_start_date <= $3
       AND (sc.effective_end_date IS NULL OR sc.effective_end_date >= $3)
     ORDER BY sc.service_id NULLS LAST, sc.effective_start_date DESC
     LIMIT 1`,
    [serviceId, departmentId ?? null, date],
    client,
  ));
}

const values = (s) => [s.departmentId, s.serviceId, s.workingDays, s.openingTime, s.closingTime, s.dailyCapacity,
  s.effectiveStartDate, s.effectiveEndDate];

export async function create(s) {
  await query(
    `INSERT INTO schedules (id, status, department_id, service_id, working_days, opening_time, closing_time, daily_capacity,
       effective_start_date, effective_end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [s.id, s.status ?? "ACTIVE", ...values(s)],
  );
}

/** Replaces the editable fields (status only when given); false when the schedule does not exist. */
export async function update(id, s) {
  const { rowCount } = await query(
    `UPDATE schedules SET department_id = $2, service_id = $3, working_days = $4, opening_time = $5, closing_time = $6,
       daily_capacity = $7, effective_start_date = $8, effective_end_date = $9, status = COALESCE($10, status), updated_at = now()
     WHERE id = $1`,
    [id, ...values(s), s.status ?? null],
  );
  return rowCount > 0;
}

/** Flips ACTIVE <-> INACTIVE; returns the new status, or null when the schedule does not exist. */
export async function toggleStatus(id) {
  const row = await one(
    `UPDATE schedules SET status = CASE WHEN status = 'ACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END, updated_at = now()
     WHERE id = $1 RETURNING status`,
    [id],
  );
  return row ? row.status : null;
}

export async function remove(id) {
  const { rowCount } = await query("DELETE FROM schedules WHERE id = $1", [id]);
  return rowCount > 0;
}
