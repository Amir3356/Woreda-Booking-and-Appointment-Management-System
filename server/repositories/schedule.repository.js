// Data access for "schedules", joined with department and service names.
import { one, query, rows, transaction } from "../config/database.js";
import { fromRow } from "../models/schedule.model.js";
import { containsPattern } from "../utils/pagination.js";

const FROM_WITH_NAMES = `
  FROM schedules sc
  LEFT JOIN departments d ON d.id = sc.department_id
  LEFT JOIN services s ON s.id = sc.service_id`;

// Each service's own daily capacity in the schedule, as [{ serviceId, service, dailyCapacity }].
const SERVICE_CAPACITIES = `
  (SELECT COALESCE(json_agg(json_build_object('serviceId', c.service_id, 'service', sv.name, 'dailyCapacity', c.daily_capacity)
                            ORDER BY sv.name), '[]'::json)
   FROM schedule_service_capacities c JOIN services sv ON sv.id = c.service_id
   WHERE c.schedule_id = sc.id) AS service_capacities`;

const SELECT_WITH_NAMES = `
  SELECT sc.*, d.name AS department_name, s.name AS service_name, ${SERVICE_CAPACITIES}
  ${FROM_WITH_NAMES}`;

/** The capacity of the service given as query parameter $n in this schedule (null when it has none of its own). */
const ownCapacity = (n) =>
  `(SELECT c.daily_capacity FROM schedule_service_capacities c WHERE c.schedule_id = sc.id AND c.service_id = $${n}) AS own_capacity`;

/** All schedules: Woreda-wide (all departments) first, then by department name, newest effective start first. */
export async function findAll() {
  return (await rows(`${SELECT_WITH_NAMES} ORDER BY d.name NULLS FIRST, sc.effective_start_date DESC, sc.id DESC`)).map(fromRow);
}

/** Cursor-paged schedules matching optional department scope, status filter, and search term. */
export async function findPage({ departmentId, search = "", status = "", offset = 0, limit = 5 } = {}) {
  const params = [];
  const where = [];
  if (departmentId) {
    params.push(departmentId);
    where.push(`(sc.department_id = $${params.length} OR sc.department_id IS NULL)`);
  }
  const normalizedStatus = status ? status.trim().toUpperCase() : "";
  if (normalizedStatus && normalizedStatus !== "ALL") {
    params.push(normalizedStatus);
    where.push(`sc.status = $${params.length}`);
  }
  if (search && search.trim()) {
    params.push(containsPattern(search.trim()));
    const idx = params.length;
    where.push(`(sc.id ILIKE $${idx} OR COALESCE(d.name, '') ILIKE $${idx} OR COALESCE(s.name, '') ILIKE $${idx})`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ total }] = await rows(`SELECT COUNT(*)::int AS total ${FROM_WITH_NAMES} ${whereClause}`, params);
  const items = await rows(
    `${SELECT_WITH_NAMES} ${whereClause}
     ORDER BY d.name NULLS FIRST, sc.effective_start_date DESC, sc.id DESC
     OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, offset, limit],
  );
  return { total, items: items.map(fromRow) };
}

/**
 * ACTIVE schedules, optionally those that apply to one department (its own and the Woreda-wide
 * ones) or only those for a service / department-wide ones.
 */
export async function findActiveList({ departmentId, serviceId } = {}, client) {
  const params = [];
  const where = ["sc.status = 'ACTIVE'"];
  if (departmentId) {
    params.push(departmentId);
    where.push(`(sc.department_id = $${params.length} OR sc.department_id IS NULL)`);
  }
  let extra = "";
  if (serviceId) {
    params.push(serviceId);
    where.push(`(sc.service_id = $${params.length} OR sc.service_id IS NULL)`);
    extra = `, ${ownCapacity(params.length)}`; // dailyCapacity becomes that service's own capacity
  }
  return (await rows(
    `SELECT sc.*, d.name AS department_name, s.name AS service_name, ${SERVICE_CAPACITIES}${extra}
     ${FROM_WITH_NAMES} WHERE ${where.join(" AND ")} ORDER BY d.name NULLS FIRST, sc.effective_start_date`,
    params,
    client,
  )).map(fromRow);
}

export async function findById(id) {
  return fromRow(await one(`${SELECT_WITH_NAMES} WHERE sc.id = $1`, [id]));
}

/** ACTIVE schedules whose effective period has not ended before date (the citizen booking page). */
export async function findBookable(date) {
  const list = await rows(
    `${SELECT_WITH_NAMES}
     WHERE sc.status = 'ACTIVE' AND (sc.effective_end_date IS NULL OR sc.effective_end_date >= $1)
     ORDER BY d.name NULLS FIRST, sc.effective_start_date`,
    [date],
  );
  return list.map(fromRow);
}

/**
 * The ACTIVE schedule effective on date for a service: its own, else its department's
 * department-wide one, else the Woreda-wide one (all departments). Most specific wins. Null if none.
 * Its dailyCapacity is the service's own Daily Appointment Capacity when the schedule sets one.
 */
export async function findActive(serviceId, departmentId, date, client) {
  return fromRow(await one(
    `SELECT sc.*, d.name AS department_name, s.name AS service_name, ${SERVICE_CAPACITIES}, ${ownCapacity(1)}
     ${FROM_WITH_NAMES}
     WHERE sc.status = 'ACTIVE'
       AND (sc.service_id = $1
            OR (sc.service_id IS NULL AND (sc.department_id IS NULL OR ($2::text IS NOT NULL AND sc.department_id = $2))))
       AND sc.effective_start_date <= $3
       AND (sc.effective_end_date IS NULL OR sc.effective_end_date >= $3)
     ORDER BY sc.service_id NULLS LAST, sc.department_id NULLS LAST, sc.effective_start_date DESC
     LIMIT 1`,
    [serviceId, departmentId ?? null, date],
    client,
  ));
}

/** Default capacity for services without their own (e.g. services added after the schedule). */
export const DEFAULT_SERVICE_CAPACITY = 20;

const values = (s) => [s.departmentId, s.serviceId, s.workingDays, s.openingTime, s.closingTime, s.dailyCapacity ?? null,
  s.effectiveStartDate, s.effectiveEndDate, s.lunchStart ?? null, s.lunchEnd ?? null];

/** Replaces the per-service capacities of a schedule when a list is given (null leaves them unchanged). */
async function replaceServiceCapacities(client, scheduleId, list) {
  if (!list) return;
  await client.query("DELETE FROM schedule_service_capacities WHERE schedule_id = $1", [scheduleId]);
  if (list.length === 0) return;
  await client.query(
    `INSERT INTO schedule_service_capacities (schedule_id, service_id, daily_capacity)
     SELECT $1, x.service_id, x.daily_capacity FROM unnest($2::text[], $3::int[]) AS x(service_id, daily_capacity)`,
    [scheduleId, list.map((c) => c.serviceId), list.map((c) => c.dailyCapacity)],
  );
}

export function create(s) {
  return transaction(async (client) => {
    await client.query(
      `INSERT INTO schedules (id, status, department_id, service_id, working_days, opening_time, closing_time, daily_capacity,
         effective_start_date, effective_end_date, lunch_start, lunch_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, ${DEFAULT_SERVICE_CAPACITY}), $9, $10, $11, $12)`,
      [s.id, s.status ?? "ACTIVE", ...values(s)],
    );
    await replaceServiceCapacities(client, s.id, s.serviceCapacities ?? []);
  });
}

/** Replaces the editable fields (status and default capacity only when given); false when the schedule does not exist. */
export function update(id, s) {
  return transaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE schedules SET department_id = $2, service_id = $3, working_days = $4, opening_time = $5, closing_time = $6,
         daily_capacity = COALESCE($7, daily_capacity), effective_start_date = $8, effective_end_date = $9, lunch_start = $10,
         lunch_end = $11, status = COALESCE($12, status), updated_at = now()
       WHERE id = $1`,
      [id, ...values(s), s.status ?? null],
    );
    if (rowCount === 0) return false;
    await replaceServiceCapacities(client, id, s.serviceCapacities);
    return true;
  });
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
