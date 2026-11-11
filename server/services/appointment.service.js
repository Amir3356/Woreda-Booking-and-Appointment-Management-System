// Appointment use cases: booking with schedule and capacity checks, tracking, history, registry,
// review, reschedule, cancel and slip. Every change is audited and announced to open pages.
import { lockKey, transaction } from "../config/database.js";
import {
  ConflictError, DailyCapacityError, ForbiddenError, NotFoundError, SlotFullError, UnauthorizedError, invalid, isDuplicateKey,
} from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { nowMinutes, today } from "../utils/date.js";
import { pagination } from "../utils/pagination.js";
import { DEFAULT_MAX_PARALLEL_SLOTS, perTimeCapacity, scheduleIssue, slotMinutes } from "../utils/slots.js";
import { referenceNumber, stageIndex } from "../models/appointment.model.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";
import * as users from "../repositories/user.repository.js";
import * as settings from "../repositories/settings.repository.js";
import * as schedules from "../repositories/schedule.repository.js";

const SLIP_INSTRUCTIONS = Object.freeze([
  "Arrive 15 minutes before your time slot.",
  "Bring all original required documents.",
  "Present this slip at the reception desk for check-in.",
]);

/**
 * Inside a transaction: the schedule must be open on date/timeSlot, and the day and the time slot
 * must have a free place. The advisory lock serializes bookings of the same service and day, so a
 * slot is never overbooked. excludeId: the appointment being moved (its own place does not count).
 * fields: the request field names for the 422 ("date"/"timeSlot" or "newDate"/"newTimeSlot").
 */
async function reservePlace(client, { serviceId, departmentId, date, timeSlot, excludeId = null }, fields) {
  await lockKey(client, `slot:${serviceId}|${date}`);
  // The service's own schedule, else its department's (Admin > Schedule Management).
  const schedule = await schedules.findActive(serviceId, departmentId, date, client);
  const issue = scheduleIssue(schedule, date, timeSlot);
  if (issue) invalid(fields[issue.field], issue.issue);
  // Today, a time that has already started can no longer be booked.
  if (date === today() && slotMinutes(timeSlot) <= nowMinutes()) {
    invalid(fields.timeSlot, "That time has already passed today. Choose a later time or another date.");
  }
  const perTime = perTimeCapacity(schedule, (await settings.findMaxParallelSlots(client)) ?? DEFAULT_MAX_PARALLEL_SLOTS);
  const taken = await appointments.countTaken({ serviceId, date, timeSlot, excludeId }, client);
  if (taken.day >= schedule.dailyCapacity) throw new DailyCapacityError(schedule.dailyCapacity, date);
  if (taken.slot >= perTime) throw new SlotFullError();
}

/** Inserts with a fresh reference number; a collision (1 in 9000 per day) is retried. */
async function insertWithReference(client, fields) {
  for (let attempt = 1; ; attempt++) {
    const id = newId("apt");
    await client.query("SAVEPOINT new_appointment");
    try {
      await appointments.create({ id, referenceNumber: referenceNumber(today()), ...fields }, client);
      return id;
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT new_appointment");
      if (!isDuplicateKey(err) || attempt >= 5) throw err;
    }
  }
}

/** audit: { record(caller, action, appointment, opts) }, events: { publish(type, id, data) } */
export function createAppointmentService({ events, audit }) {
  /** Fetches an appointment and enforces ownership (citizen) / department (officer) scoping. */
  async function load(caller, id) {
    const a = await appointments.findById(id);
    if (!a) throw new NotFoundError();
    if (caller.role === "CITIZEN" && a.citizenId !== caller.userId) throw new ForbiddenError();
    if (caller.role === "OFFICER" && a.departmentId !== caller.departmentId) throw new ForbiddenError();
    return a;
  }

  const service = {
    /** POST /appointments: a signed-in caller books for themselves. req: validated body. */
    async book(caller, req) {
      if (!caller.authenticated) throw new UnauthorizedError("sign in to book an appointment");

      const cs = await publicServices.findWithDepartment(req.serviceId);
      if (!cs || !cs.active || !cs.departmentActive) throw new NotFoundError();
      if (!(await users.exists(caller.userId))) throw new UnauthorizedError("user account not found");

      const id = await transaction(async (client) => {
        await reservePlace(client, { serviceId: req.serviceId, departmentId: cs.departmentId, date: req.date, timeSlot: req.timeSlot },
          { date: "date", timeSlot: "timeSlot" });
        return insertWithReference(client, {
          citizenId: caller.userId, citizenName: req.citizenName, citizenPhone: req.citizenPhone,
          citizenEmail: req.citizenEmail, departmentId: cs.departmentId, serviceId: req.serviceId,
          date: req.date, timeSlot: req.timeSlot, status: "PENDING", citizenNotes: req.citizenNotes,
        });
      });
      const a = await appointments.findById(id);
      await audit.record(caller, "BOOKED", a);
      events.publish("appointment.booked", a.id, a);
      return a;
    },

    /** GET /appointments/track?ref=: latest appointment by reference number or citizen phone. */
    async track(ref) {
      const a = await appointments.findLatestByReferenceOrPhone(ref);
      if (!a) throw new NotFoundError();
      return {
        referenceNumber: a.referenceNumber, citizenName: a.citizenName, serviceName: a.serviceName,
        departmentName: a.departmentName, date: a.date, timeSlot: a.timeSlot, status: a.status,
        tokenNumber: a.tokenNumber, currentStageIndex: stageIndex(a.status), officerNotes: a.officerNotes,
      };
    },

    /** GET /appointments/my: the caller's history for a client tab. */
    mine(caller, { tab, search }) {
      const filter = { citizenId: caller.userId, search };
      switch (tab) {
        case "UPCOMING":
          filter.fromDate = today();
          filter.statuses = ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS"];
          break;
        case "COMPLETED":
          filter.statuses = ["COMPLETED"];
          break;
        case "CANCELLED":
          filter.statuses = ["CANCELLED", "REJECTED", "NO_SHOW"];
          break;
      }
      return appointments.findByCitizen(filter);
    },

    /** A page of the registry; officers only see their own department. f: validated registry query. */
    list(caller, f) {
      const filter = {
        departmentId: caller.role === "OFFICER" ? caller.departmentId : f.departmentId,
        status: f.status,
        search: f.search,
      };
      switch (f.timeframe) {
        case "TODAY":
          filter.date = today();
          break;
        case "UPCOMING":
          filter.afterDate = today();
          break;
      }
      return appointments.findPage(filter, { page: f.page, limit: f.limit });
    },

    /** GET /appointments: one page plus pagination meta. */
    async listPage(caller, f) {
      const { items, total } = await service.list(caller, f);
      return { items, pagination: pagination(total, f.page, f.limit) };
    },

    /** PATCH /appointments/:id/status: approve or reject a PENDING appointment. */
    async review(caller, id, u) {
      await load(caller, id);
      const updated = await appointments.review(id, {
        status: u.status, officerNotes: u.officerNotes, rejectionReason: u.rejectionReason, officerId: caller.userId,
      });
      if (!updated) throw new ConflictError("appointment is not pending review");
      const a = await appointments.findById(id);
      await audit.record(caller, u.status, a, {
        fromStatus: "PENDING",
        reason: u.status === "REJECTED" ? u.rejectionReason : u.officerNotes,
      });
      events.publish(`appointment.${u.status.toLowerCase()}`, id, a);
      return a;
    },

    /** POST /appointments/:id/reschedule: moves to a new slot (schedule- and capacity-checked) and resets to APPROVED. */
    async reschedule(caller, id, req) {
      const prev = await load(caller, id);

      await transaction(async (client) => {
        const current = await appointments.findByIdForUpdate(id, client);
        if (!current || current.status !== prev.status || current.date !== prev.date || current.timeSlot !== prev.timeSlot) {
          throw new ConflictError("appointment changed while rescheduling; please retry");
        }
        await reservePlace(client,
          { serviceId: prev.serviceId, departmentId: prev.departmentId, date: req.newDate, timeSlot: req.newTimeSlot, excludeId: id },
          { date: "newDate", timeSlot: "newTimeSlot" });
        await appointments.reschedule(id, req.newDate, req.newTimeSlot, client);
      });

      const a = await appointments.findById(id);
      await audit.record(caller, "RESCHEDULED", a, {
        fromStatus: prev.status,
        reason: `${prev.date} ${prev.timeSlot} -> ${a.date} ${a.timeSlot}${req.reason ? `: ${req.reason}` : ""}`,
      });
      events.publish("appointment.rescheduled", id, { previousDate: prev.date, previousTimeSlot: prev.timeSlot, reason: req.reason, appointment: a });
      return a;
    },

    /**
     * POST /appointments/:id/cancel. A citizen may cancel only while the booking is PENDING: once a
     * department officer has approved it, it stays. Officers and the administrator can still cancel
     * PENDING or APPROVED appointments. A cancelled appointment no longer holds a place.
     */
    async cancel(caller, id) {
      const prev = await load(caller, id);
      const isCitizen = caller.role === "CITIZEN";
      if (!(await appointments.cancel(id, isCitizen ? ["PENDING"] : ["PENDING", "APPROVED"]))) {
        throw new ConflictError(
          isCitizen && prev.status === "APPROVED"
            ? "an approved appointment can no longer be cancelled by the citizen"
            : isCitizen
              ? "only pending appointments can be cancelled"
              : "only pending or approved appointments can be cancelled",
        );
      }
      await audit.record(caller, "CANCELLED", await appointments.findById(id), { fromStatus: prev.status });
      events.publish("appointment.cancelled", id, null);
      return { id, status: "CANCELLED" };
    },

    /** GET /appointments/:id/slip: printable slip with the department's room and the required documents. */
    async slip(id) {
      const a = await appointments.findById(id);
      if (!a) throw new NotFoundError();
      const cs = await publicServices.findWithDepartment(a.serviceId);
      return {
        appointment: a,
        buildingRoom: cs?.buildingRoom ?? "",
        requiredDocuments: cs?.requiredDocuments?.length ? cs.requiredDocuments : null,
        instructions: [...SLIP_INSTRUCTIONS],
        barcode: a.referenceNumber,
      };
    },
  };
  return service;
}
