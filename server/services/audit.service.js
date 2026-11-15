// Audit trail of appointment decisions (Admin > Audit Trail): who approved, rejected, booked,
// cancelled or rescheduled which appointment, and when. Recording never fails the user's request:
// an error is logged instead.
import { newId } from "../utils/id.js";
import { encodeAuditCursor } from "../validations/appointment.validation.js";
import * as auditLogs from "../repositories/auditLog.repository.js";

/** The parts of an appointment an audit entry snapshots before and after an action. */
const snapshot = (a) => ({ status: a.status ?? null, date: a.date ?? null, timeSlot: a.timeSlot ?? null });

export function createAuditService({ logger, events } = {}) {
  return {
    /**
     * caller: req.caller; appointment: the appointment after the change (API shape).
     * before: the appointment before the change (defaults to the same date and time with fromStatus;
     * none when fromStatus is null, i.e. the action created the appointment).
     */
    async record(caller, action, appointment, { fromStatus = null, reason = null, before } = {}) {
      try {
        const after = snapshot(appointment);
        const beforeSnapshot = before !== undefined
          ? (before ? snapshot(before) : null)
          : (fromStatus ? { ...after, status: fromStatus } : null);
        const entry = await auditLogs.create({
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
          beforeSnapshot,
          afterSnapshot: after,
        });
        events?.publish("audit.created", entry?.id, entry);
      } catch (err) {
        logger.error({ action, appointmentId: appointment?.id, err: err.message }, "audit entry not saved");
      }
    },

    /**
     * GET /audit-logs: one page of entries, newest first, by keyset cursor (pages stay stable while
     * new entries arrive). f: validated query { action, departmentId, search, cursor, pageSize }.
     */
    async list({ action, departmentId, search, cursor, pageSize }) {
      const filters = { action, departmentId, search };
      let { items, before, total } = await auditLogs.findKeysetPage(filters, { cursor, pageSize });
      // Going back near the top after new entries arrived would leave a few newest entries above a
      // "page 1": snap to the real first page instead, so Previous always ends at the newest entries.
      if (cursor?.direction === "b" && before > 0 && before < pageSize) {
        ({ items, before, total } = await auditLogs.findKeysetPage(filters, { cursor: null, pageSize }));
      }
      const first = items[0]?.cursorKey;
      const last = items.at(-1)?.cursorKey;
      const hasPrev = before > 0;
      const hasNext = before + items.length < total;
      return {
        items: items.map(({ cursorKey, ...entry }) => entry),
        cursor: {
          current: before, // entries before this page: "Showing 6-10 of 23" and the page number
          pageSize,
          totalCount: total,
          hasPrev,
          hasNext,
          prevCursor: hasPrev && first ? encodeAuditCursor("b", first.at, first.id) : null,
          nextCursor: hasNext && last ? encodeAuditCursor("a", last.at, last.id) : null,
        },
      };
    },
  };
}
