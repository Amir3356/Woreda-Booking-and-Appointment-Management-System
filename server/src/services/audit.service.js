// Audit trail of appointment decisions (Admin > Audit Trail): who approved, rejected, booked,
// cancelled or rescheduled which appointment, and when. Recording never fails the user's request:
// an error is logged instead.
import { newId } from "../utils/id.js";
import { pagination } from "../utils/pagination.js";
import * as auditLogs from "../repositories/auditLog.repository.js";

export function createAuditService({ logger }) {
  return {
    /** caller: req.caller; appointment: the appointment after the change (API shape). */
    async record(caller, action, appointment, { fromStatus = null, reason = null } = {}) {
      try {
        await auditLogs.create({
          id: newId("aud"),
          action,
          fromStatus,
          toStatus: appointment.status,
          actorId: caller?.userId || null,
          actorName: caller?.name || "",
          actorRole: caller?.role || "",
          appointmentId: appointment.id,
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
        logger.error({ action, appointmentId: appointment?.id, err: err.message }, "audit entry not saved");
      }
    },

    /** GET /audit-logs: a page of entries, newest first. f: validated query. */
    async list({ action, departmentId, search, page, limit }) {
      const { items, total } = await auditLogs.findPage({ action, departmentId, search }, { page, limit });
      return { items, pagination: pagination(total, page, limit) };
    },
  };
}
