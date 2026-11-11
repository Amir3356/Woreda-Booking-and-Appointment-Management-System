// Data access for calendar exceptions, per-date booking closures and department daily capacities.
import { one, query, rows, transaction } from "../config/database.js";
import { exceptionFromRow } from "../models/calendar.model.js";

const SELECT_EXCEPTIONS = `
  SELECT e.*,
    COALESCE(array_agg(d.id ORDER BY d.name) FILTER (WHERE d.id IS NOT NULL), '{}') AS department_ids,
    COALESCE(array_agg(d.name ORDER BY d.name) FILTER (WHERE d.id IS NOT NULL), '{}') AS department_names
  FROM calendar_exceptions e
  LEFT JOIN calendar_exception_departments ed ON ed.exception_id = e.id
  LEFT JOIN departments d ON d.id = ed.department_id`;

// ---- calendar exceptions ----

/**
 * Exceptions overlapping [from, to] (either bound optional), optionally only those covering a
 * department (scope ALL or listing it) and of the given types; ordered by start date.
 */
export async function findExceptions({ from, to, departmentId, types } = {}, client) {
  const params = [];
  const where = [];
  if (from) {
    params.push(from);
    where.push(`e.end_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`e.start_date <= $${params.length}`);
  }
  if (departmentId) {
    params.push(departmentId);
    where.push(`(e.scope = 'ALL' OR EXISTS (SELECT 1 FROM calendar_exception_departments x
                 WHERE x.exception_id = e.id AND x.department_id = $${params.length}))`);
  }
  if (types?.length) {
    params.push(types);
    where.push(`e.type = ANY($${params.length})`);
  }
  const list = await rows(
    `${SELECT_EXCEPTIONS} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY e.id ORDER BY e.start_date, e.end_date, e.title`,
    params,
    client,
  );
  return list.map(exceptionFromRow);
}

export async function findExceptionById(id, client) {
  return exceptionFromRow(await one(`${SELECT_EXCEPTIONS} WHERE e.id = $1 GROUP BY e.id`, [id], client));
}

const exceptionValues = (e) => [e.type, e.title, e.description, e.startDate, e.endDate, e.scope,
  e.openingTime, e.closingTime, e.dailyCapacity];

async function replaceDepartments(client, id, scope, departmentIds) {
  await client.query("DELETE FROM calendar_exception_departments WHERE exception_id = $1", [id]);
  if (scope === "ALL" || departmentIds.length === 0) return;
  await client.query(
    `INSERT INTO calendar_exception_departments (exception_id, department_id)
     SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [id, departmentIds],
  );
}

export function createException(e) {
  return transaction(async (client) => {
    await client.query(
      `INSERT INTO calendar_exceptions (id, type, title, description, start_date, end_date, scope,
         opening_time, closing_time, daily_capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [e.id, ...exceptionValues(e), e.createdBy ?? null],
    );
    await replaceDepartments(client, e.id, e.scope, e.departmentIds);
  });
}

/** Replaces every editable field and the department list; false when the exception does not exist. */
export function updateException(id, e) {
  return transaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE calendar_exceptions SET type = $2, title = $3, description = $4, start_date = $5, end_date = $6,
         scope = $7, opening_time = $8, closing_time = $9, daily_capacity = $10, updated_at = now()
       WHERE id = $1`,
      [id, ...exceptionValues(e)],
    );
    if (rowCount === 0) return false;
    await replaceDepartments(client, id, e.scope, e.departmentIds);
    return true;
  });
}

export async function removeException(id) {
  const { rowCount } = await query("DELETE FROM calendar_exceptions WHERE id = $1", [id]);
  return rowCount > 0;
}

// ---- booking closures (Appointment Availability) ----

/** Closures in [from, to], optionally for some departments: [{ departmentId, date, reason }]. */
export async function findClosures({ from, to, departmentIds } = {}, client) {
  const params = [from, to];
  let filter = "";
  if (departmentIds?.length) {
    params.push(departmentIds);
    filter = "AND department_id = ANY($3)";
  }
  const list = await rows(
    `SELECT department_id, date, reason FROM booking_closures WHERE date BETWEEN $1 AND $2 ${filter} ORDER BY date`,
    params,
    client,
  );
  return list.map((r) => ({ departmentId: r.department_id, date: r.date, reason: r.reason ?? "" }));
}

/** The closure of one department on one date, or null. */
export async function findClosure(departmentId, date, client) {
  const r = await one("SELECT reason FROM booking_closures WHERE department_id = $1 AND date = $2", [departmentId, date], client);
  return r ? { reason: r.reason ?? "" } : null;
}

/** Closes booking for every department on every date in [from, to]; returns rows written. */
export async function closeDates({ departmentIds, from, to, reason, by }) {
  const { rowCount } = await query(
    `INSERT INTO booking_closures (department_id, date, reason, created_by)
     SELECT dep, day::date, $4, $5
     FROM unnest($1::text[]) AS dep, generate_series($2::date, $3::date, interval '1 day') AS day
     ON CONFLICT (department_id, date) DO UPDATE SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now()`,
    [departmentIds, from, to, reason ?? null, by ?? null],
  );
  return rowCount;
}

/** Re-opens booking for the departments on [from, to]; returns rows removed. */
export async function openDates({ departmentIds, from, to }) {
  const { rowCount } = await query(
    "DELETE FROM booking_closures WHERE department_id = ANY($1) AND date BETWEEN $2 AND $3",
    [departmentIds, from, to],
  );
  return rowCount;
}

// ---- department daily capacities ----

/** { departmentId: dailyCapacity } for every department that has one. */
export async function findCapacities(client) {
  const list = await rows("SELECT department_id, daily_capacity FROM department_capacities", [], client);
  return Object.fromEntries(list.map((r) => [r.department_id, r.daily_capacity]));
}

export async function findCapacity(departmentId, client) {
  const r = await one("SELECT daily_capacity FROM department_capacities WHERE department_id = $1", [departmentId], client);
  return r ? r.daily_capacity : null;
}

export async function upsertCapacity(departmentId, dailyCapacity, by) {
  await query(
    `INSERT INTO department_capacities (department_id, daily_capacity, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (department_id) DO UPDATE SET daily_capacity = EXCLUDED.daily_capacity,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [departmentId, dailyCapacity, by ?? null],
  );
}

export async function removeCapacity(departmentId) {
  const { rowCount } = await query("DELETE FROM department_capacities WHERE department_id = $1", [departmentId]);
  return rowCount > 0;
}
