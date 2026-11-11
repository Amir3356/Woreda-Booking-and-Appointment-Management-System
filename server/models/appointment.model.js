// Table "appointments" and the pure appointment rules (no I/O).
import { randomInt } from "node:crypto";

export const STATUSES = Object.freeze([
  "PENDING", "APPROVED", "REJECTED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW",
]);

/** Statuses that do not occupy a place in their day / time slot. */
export const RELEASED_STATUSES = Object.freeze(["CANCELLED", "REJECTED"]);

/** appointments row joined with department_name / service_name -> API shape. */
export function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    referenceNumber: r.reference_number,
    citizenId: r.citizen_id,
    citizenName: r.citizen_name,
    citizenPhone: r.citizen_phone,
    citizenEmail: r.citizen_email ?? null,
    departmentId: r.department_id,
    departmentName: r.department_name ?? "",
    serviceId: r.service_id,
    serviceName: r.service_name ?? "",
    date: r.date,
    timeSlot: r.time_slot,
    status: r.status,
    tokenNumber: r.token_number ?? null,
    citizenNotes: r.citizen_notes ?? null,
    officerNotes: r.officer_notes ?? null,
    rejectionReason: r.rejection_reason ?? null,
    responsibleOfficerId: r.responsible_officer_id ?? null,
    checkedInAt: r.checked_in_at ?? null,
    completedAt: r.completed_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** "WRD-YYYYMMDD-XXXX" with XXXX in 1000..9999, e.g. "WRD-20261102-4821". */
export function referenceNumber(todayStr) {
  return `WRD-${todayStr.replaceAll("-", "")}-${1000 + randomInt(9000)}`;
}

/** Public tracker stage (0 Submitted, 1 Approved, 2 Checked In, 3 In Progress, 4 Delivered). */
export function stageIndex(status) {
  return { APPROVED: 1, CHECKED_IN: 2, IN_PROGRESS: 3, COMPLETED: 4 }[status] ?? 0;
}

/** Integer percentages (truncating division). */
export function withRates(s) {
  const total = s.totalAppointments;
  return {
    ...s,
    completionRate: total > 0 ? Math.trunc((s.completedAppointments * 100) / total) : 0,
    noShowRate: total > 0 ? Math.trunc((s.noShowAppointments * 100) / total) : 0,
  };
}
