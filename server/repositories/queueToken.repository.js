// Data access for "queue_tokens" (the desk queue).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/queueToken.model.js";

/** Tokens issued for a department on a day (any status), and how many are still WAITING. */
export async function countForDay(departmentId, queueDate, client) {
  return one(
    `SELECT COUNT(*)::int AS issued, COUNT(*) FILTER (WHERE status = 'WAITING')::int AS waiting
     FROM queue_tokens WHERE department_id = $1 AND queue_date = $2`,
    [departmentId, queueDate],
    client,
  );
}

/** Inserts one token; a second token for the same appointment violates the unique appointment_id. */
export async function create(t, client) {
  await query(
    `INSERT INTO queue_tokens (id, appointment_id, token_number, department_id, counter_number, officer_id, status,
       checked_in_time, estimated_minutes_remaining, queue_date)
     VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7, $8, $9)`,
    [t.id, t.appointmentId, t.tokenNumber, t.departmentId, t.counterNumber, t.officerId, t.checkedInTime,
      t.estimatedMinutesRemaining, t.queueDate],
    client,
  );
}

const SELECT_WITH_NAMES = `
  SELECT q.*, a.citizen_name, s.name AS service_name, a.time_slot, a.date AS appointment_date
  FROM queue_tokens q
  JOIN appointments a ON a.id = q.appointment_id
  JOIN services s ON s.id = a.service_id`;

/** SERVING tokens of a department on a day, latest call first. */
export async function findServing(departmentId, queueDate) {
  const list = await rows(
    `${SELECT_WITH_NAMES} WHERE q.department_id = $1 AND q.queue_date = $2 AND q.status = 'SERVING' ORDER BY q.called_time DESC`,
    [departmentId, queueDate],
  );
  return list.map(fromRow);
}

/**
 * WAITING tokens of a department on a day.
 * Priority rule: Appointment Time (with Late-Arrival policy) -> Check-in Time (FIFO) -> Token ID.
 * Effective service priority = max(appointment_time, checked_in_time).
 */
export async function findWaiting(departmentId, queueDate) {
  const list = await rows(
    `${SELECT_WITH_NAMES}
     WHERE q.department_id = $1 AND q.queue_date = $2 AND q.status = 'WAITING'
     ORDER BY a.date ASC,
              GREATEST(
                CASE
                  WHEN a.time_slot ~* '^\\s*(1[3-9]|2[0-3]):[0-5][0-9]' THEN (regexp_replace(a.time_slot, '\\s*[ap]m', '', 'i'))::time
                  WHEN a.time_slot ~* '^\\s*\\d{1,2}:\\d{2}' THEN a.time_slot::time
                  ELSE q.checked_in_time
                END,
                q.checked_in_time
              ) ASC,
              q.checked_in_time ASC,
              q.created_at ASC,
              q.id ASC`,
    [departmentId, queueDate],
  );
  return list.map(fromRow);
}

/**
 * Moves the highest-priority WAITING token of the department/day to SERVING (FOR UPDATE SKIP LOCKED,
 * so two officers never call the same citizen); returns the token, or null when nobody is waiting.
 * Priority follows: Appointment Time -> Check-in Time (FIFO), holding late arrivals behind on-time citizens.
 */
export async function claimNextWaiting(departmentId, queueDate, { counterNumber, officerId, calledTime }, client) {
  return fromRow(await one(
    `UPDATE queue_tokens SET status = 'SERVING', counter_number = $3, officer_id = $4, called_time = $5, updated_at = now()
     WHERE id = (
       SELECT q.id FROM queue_tokens q
       JOIN appointments a ON a.id = q.appointment_id
       WHERE q.department_id = $1 AND q.queue_date = $2 AND q.status = 'WAITING'
       ORDER BY a.date ASC,
                GREATEST(
                  CASE
                    WHEN a.time_slot ~* '^\\s*(1[3-9]|2[0-3]):[0-5][0-9]' THEN (regexp_replace(a.time_slot, '\\s*[ap]m', '', 'i'))::time
                    WHEN a.time_slot ~* '^\\s*\\d{1,2}:\\d{2}' THEN a.time_slot::time
                    ELSE q.checked_in_time
                  END,
                  q.checked_in_time
                ) ASC,
                q.checked_in_time ASC,
                q.created_at ASC,
                q.id ASC
       LIMIT 1 FOR UPDATE OF q SKIP LOCKED)
     RETURNING *`,
    [departmentId, queueDate, counterNumber, officerId, calledTime],
    client,
  ));
}

/** Closes a WAITING/SERVING token (restricted to departmentId when given); returns its appointment id, or null. */
export async function finalize(id, departmentId, status, client) {
  const row = await one(
    `UPDATE queue_tokens SET status = $3, updated_at = now()
     WHERE (id = $1 OR appointment_id = $1) AND status IN ('WAITING', 'SERVING') AND ($2::text IS NULL OR department_id = $2)
     RETURNING appointment_id`,
    [id, departmentId || null, status],
    client,
  );
  return row ? row.appointment_id : null;
}

/**
 * A citizen's queue tokens for a day, each with its live place in the department's queue:
 * ahead = WAITING tokens of the same department and day that have higher priority:
 *         earlier scheduled appointment or arrived earlier on-time,
 * waitingTotal = all WAITING tokens there, nowServing = the token most recently called.
 * Only counts and token numbers of other citizens are read, never their names.
 */
export async function findForCitizen(citizenId, queueDate) {
  return rows(
    `SELECT q.id, q.token_number,
            CASE WHEN a.status = 'COMPLETED' OR q.status = 'COMPLETED' THEN 'COMPLETED' ELSE q.status END AS status,
            q.counter_number, q.called_time, q.checked_in_time, q.department_id,
            a.id AS appointment_id, a.reference_number, a.time_slot, s.name AS service_name, d.name AS department_name,
            a.created_at AS appointment_created_at,
            (SELECT COUNT(*) FROM queue_tokens w
              JOIN appointments wa ON wa.id = w.appointment_id
              WHERE w.department_id = q.department_id AND w.queue_date = q.queue_date AND w.status = 'WAITING'
                AND (
                  (wa.date,
                   GREATEST(CASE WHEN wa.time_slot ~* '^\\s*\\d{1,2}:\\d{2}' THEN wa.time_slot::time ELSE w.checked_in_time END, w.checked_in_time),
                   w.checked_in_time, w.created_at, w.id)
                  <
                  (a.date,
                   GREATEST(CASE WHEN a.time_slot ~* '^\\s*\\d{1,2}:\\d{2}' THEN a.time_slot::time ELSE q.checked_in_time END, q.checked_in_time),
                   q.checked_in_time, q.created_at, q.id)
                ))::int AS ahead,
            (SELECT COUNT(*) FROM queue_tokens w
              WHERE w.department_id = q.department_id AND w.queue_date = q.queue_date AND w.status = 'WAITING')::int AS waiting_total,
            (SELECT x.token_number FROM queue_tokens x
              WHERE x.department_id = q.department_id AND x.queue_date = q.queue_date AND x.status = 'SERVING'
              ORDER BY x.called_time DESC NULLS LAST, x.updated_at DESC LIMIT 1) AS now_serving
     FROM queue_tokens q
     JOIN appointments a ON a.id = q.appointment_id
     JOIN services s ON s.id = a.service_id
     JOIN departments d ON d.id = q.department_id
     WHERE a.citizen_id = $1 AND q.queue_date = $2
     ORDER BY q.created_at`,
    [citizenId, queueDate],
  );
}
