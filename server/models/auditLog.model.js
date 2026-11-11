// Table "audit_logs": one row per appointment decision or change, with who did it and when.
export const ACTIONS = Object.freeze(["BOOKED", "APPROVED", "REJECTED", "CANCELLED", "RESCHEDULED"]);

export function fromRow(r) {
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
    reason: r.reason ?? null,
  };
}
