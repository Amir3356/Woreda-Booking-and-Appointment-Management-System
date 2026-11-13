// Table "queue_tokens": one desk queue token per checked-in appointment.
import { pad } from "../utils/date.js";

export const STATUSES = Object.freeze(["WAITING", "SERVING", "COMPLETED", "NO_SHOW"]);

/** Rough per-citizen wait estimate (minutes). */
export const AVG_SERVICE_MINUTES = 15;

export function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    tokenNumber: r.token_number,
    departmentId: r.department_id,
    counterNumber: r.counter_number,
    officerId: r.officer_id ?? null,
    status: r.status,
    checkedInTime: r.checked_in_time,
    calledTime: r.called_time ?? null,
    estimatedMinutesRemaining: r.estimated_minutes_remaining,
    queueDate: r.queue_date,
    citizenName: r.citizen_name ?? "",
    serviceName: r.service_name ?? "",
    timeSlot: r.time_slot ?? null,
    appointmentDate: r.appointment_date ?? r.date ?? null,
  };
}

/** Daily sequential token "{DEPT_CODE}-{SEQ:02d}" (e.g. "KBL-01"). */
export function tokenNumber(deptCode, seq) {
  const code = String(deptCode ?? "").trim().toUpperCase() || "WRD";
  return `${code}-${pad(seq < 1 ? 1 : seq)}`;
}
