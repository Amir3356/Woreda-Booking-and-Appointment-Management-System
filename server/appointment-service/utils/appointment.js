// Pure appointment rules and formats (ported from the Go service package; no I/O).
import { randomInt } from "node:crypto";

/** "WRD-YYYYMMDD-XXXX" with XXXX in 1000..9999, e.g. "WRD-20261102-4821". */
export function referenceNumber(todayStr) {
  return `WRD-${todayStr.replaceAll("-", "")}-${1000 + randomInt(9000)}`;
}

/** Public tracker stage (0 Submitted, 1 Approved, 2 Checked In, 3 In Progress, 4 Delivered). */
export function stageIndex(status) {
  return { APPROVED: 1, CHECKED_IN: 2, IN_PROGRESS: 3, COMPLETED: 4 }[status] ?? 0;
}

/** Statuses that occupy a place in their time slot (Go counted status NOT IN ('CANCELLED','REJECTED')). */
export const holdsPlace = (status) => status !== "CANCELLED" && status !== "REJECTED";

/** slot_reservations _id: "<serviceId>|<date>|<timeSlot>". */
export const slotKey = (serviceId, date, timeSlot) => `${serviceId}|${date}|${timeSlot}`;

/** Integer percentages as Go computed them (truncating division). */
export function withRates(s) {
  const total = s.totalAppointments;
  return {
    ...s,
    completionRate: total > 0 ? Math.trunc((s.completedAppointments * 100) / total) : 0,
    noShowRate: total > 0 ? Math.trunc((s.noShowAppointments * 100) / total) : 0,
  };
}

/** The API shape of an appointment (Go model.Appointment field order; absent optionals are null). */
export function present(d) {
  const n = (v) => v ?? null;
  return {
    id: d._id,
    referenceNumber: d.referenceNumber,
    citizenId: d.citizenId,
    citizenName: d.citizenName,
    citizenPhone: d.citizenPhone,
    citizenEmail: n(d.citizenEmail),
    departmentId: d.departmentId,
    departmentName: d.departmentName ?? "",
    serviceId: d.serviceId,
    serviceName: d.serviceName ?? "",
    date: d.date,
    timeSlot: d.timeSlot,
    status: d.status,
    tokenNumber: n(d.tokenNumber),
    citizenNotes: n(d.citizenNotes),
    officerNotes: n(d.officerNotes),
    rejectionReason: n(d.rejectionReason),
    responsibleOfficerId: n(d.responsibleOfficerId),
    checkedInAt: n(d.checkedInAt),
    completedAt: n(d.completedAt),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
