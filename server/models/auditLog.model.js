// Table "audit_logs": one row per appointment decision or change, with who did it and when.
export const ACTIONS = Object.freeze(["BOOKED", "APPROVED", "REJECTED", "CANCELLED", "RESCHEDULED", "COMPLETED", "NO_SHOW"]);

// Entries saved before snapshots existed recorded a reschedule's old slot in the reason:
// "2026-11-20 11:00 AM -> 2026-11-21 11:30 AM: optional reason".
const LEGACY_RESCHEDULE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2} [AP]M) -> \S+ \S+ [AP]M(?:: (.*))?$/s;

/** Before/after snapshots ({status, date, timeSlot}); derived for entries saved before snapshots existed. */
function snapshots(r) {
  const after = r.after_snapshot ?? { status: r.to_status, date: r.appointment_date || null, timeSlot: r.time_slot || null };
  if (r.before_snapshot !== undefined && r.before_snapshot !== null) return { before: r.before_snapshot, after, reason: r.reason ?? null };
  if (!r.from_status) return { before: null, after, reason: r.reason ?? null };
  const legacy = r.action === "RESCHEDULED" && !r.after_snapshot ? LEGACY_RESCHEDULE.exec(r.reason ?? "") : null;
  if (legacy) return { before: { status: r.from_status, date: legacy[1], timeSlot: legacy[2] }, after, reason: legacy[3] ?? null };
  return { before: { ...after, status: r.from_status }, after, reason: r.reason ?? null };
}

export function fromRow(r) {
  const { before, after, reason } = snapshots(r);
  return {
    id: r.id,
    at: r.at,
    action: r.action,
    fromStatus: r.from_status ?? null,
    toStatus: r.to_status,
    actorId: r.actor_id ?? null,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    appointmentId: r.appointment_id,
    referenceNumber: r.reference_number,
    citizenName: r.citizen_name,
    departmentId: r.department_id ?? null,
    departmentName: r.department_name,
    serviceName: r.service_name,
    appointmentDate: r.appointment_date,
    timeSlot: r.time_slot,
    reason,
    before,
    after,
  };
}
