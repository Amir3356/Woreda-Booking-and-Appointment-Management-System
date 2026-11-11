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
  SELECT q.*, a.citizen_name, s.name AS service_name
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

/** WAITING tokens of a department on a day, oldest first. */
export async function findWaiting(departmentId, queueDate) {
  const list = await rows(
    `${SELECT_WITH_NAMES} WHERE q.department_id = $1 AND q.queue_date = $2 AND q.status = 'WAITING' ORDER BY q.created_at, q.id`,
    [departmentId, queueDate],
  );
  return list.map(fromRow);
}

/**
 * Moves the oldest WAITING token of the department/day to SERVING (FOR UPDATE SKIP LOCKED, so two
 * officers never call the same citizen); returns the token, or null when nobody is waiting.
 */
export async function claimNextWaiting(departmentId, queueDate, { counterNumber, officerId, calledTime }, client) {
  return fromRow(await one(
    `UPDATE queue_tokens SET status = 'SERVING', counter_number = $3, officer_id = $4, called_time = $5, updated_at = now()
     WHERE id = (
       SELECT id FROM queue_tokens
       WHERE department_id = $1 AND queue_date = $2 AND status = 'WAITING'
       ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
    [departmentId, queueDate, counterNumber, officerId, calledTime],
    client,
  ));
}

/** Closes a WAITING/SERVING token (restricted to departmentId when given); returns its appointment id, or null. */
export async function finalize(id, departmentId, status, client) {
  const row = await one(
    `UPDATE queue_tokens SET status = $3, updated_at = now()
     WHERE id = $1 AND status IN ('WAITING', 'SERVING') AND ($2::text IS NULL OR department_id = $2)
     RETURNING appointment_id`,
    [id, departmentId || null, status],
    client,
  );
  return row ? row.appointment_id : null;
}
