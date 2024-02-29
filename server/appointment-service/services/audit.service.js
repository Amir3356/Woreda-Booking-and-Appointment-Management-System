// Audit trail of appointment decisions (Admin > Audit Trail): who approved, rejected, booked,
// cancelled or rescheduled which appointment, and when. Recording never fails the user's request:
// an error is logged instead.
import { newId } from "../utils/id.js";
import { normalizePage, pagination } from "../utils/pagination.js";
import * as auditLogs from "../repositories/auditLog.repository.js";
import { counter } from "../config/metrics.js";

const appointmentActions = counter(
  "woreda_appointment_actions_total",
  "Appointment actions: BOOKED (Pending), APPROVED, REJECTED, CANCELLED, RESCHEDULED, by department and role.",
  ["action", "department", "role"],
);

export const AUDIT_ACTIONS = ["BOOKED", "APPROVED", "REJECTED", "CANCELLED", "RESCHEDULED"];

export function createAuditService({ logger }) {
  return {
    /** caller: req.caller; appointment: the appointment after the change (API shape or document). */
    async record(caller, action, appointment, { fromStatus = null, reason = null } = {}) {
      appointmentActions.inc({ action, department: appointment.departmentName || "unknown", role: caller?.role || "unknown" });
      try {
        await auditLogs.create({
          _id: newId("aud"),
          at: new Date(),
          action,
          fromStatus,
          toStatus: appointment.status,
          actorId: caller?.userId || null,
          actorName: caller?.name || "",
          actorRole: caller?.role || "",
          appointmentId: appointment.id ?? appointment._id,
          referenceNumber: appointment.referenceNumber ?? "",
          citizenName: appointment.citizenName ?? "",
          departmentId: appointment.departmentId ?? null,
          departmentName: appointment.departmentName ?? "",
          serviceName: appointment.serviceName ?? "",
          appointmentDate: appointment.date ?? "",
          timeSlot: appointment.timeSlot ?? "",
          reason: reason || null,
        });
      } catch (err) {
        logger.error({ action, appointmentId: appointment?.id ?? appointment?._id, err: err.message }, "audit entry not saved");
      }
    },

    /** GET /audit-logs: a page of entries, newest first. */
    async list(f) {
      const { page, limit } = normalizePage(f.page, f.limit);
      const action = String(f.action ?? "").toUpperCase();
      const filter = {
        action: AUDIT_ACTIONS.includes(action) ? action : "",
        departmentId: String(f.departmentId ?? ""),
        search: String(f.search ?? "").trim(),
      };
      const { docs, total } = await auditLogs.findPage(filter, { page, limit });
      return { items: docs.map((d) => d.toJSON()), pagination: pagination(total, page, limit) };
    },
  };
}
