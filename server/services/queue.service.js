// The desk queue: check-in, live board, call-next and finalize. Each step that changes a queue
// token also moves its appointment in the same transaction, and is announced to open pages.
import { subject } from "@casl/ability";
import { lockKey, transaction } from "../config/database.js";
import { ConflictError, ForbiddenError, NotFoundError, invalid, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { clock12, clockTime, today } from "../utils/date.js";
import { AVG_SERVICE_MINUTES, tokenNumber as queueTokenNumber } from "../models/queueToken.model.js";
import * as queueTokens from "../repositories/queueToken.repository.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as users from "../repositories/user.repository.js";

/** Appointment statuses after which the desk has nothing more to finalize. */
const FINAL_STATUSES = new Set(["COMPLETED", "NO_SHOW"]);

/**
 * Creates today's next sequential token ({DEPT_CODE}-{count+1:02d}) and marks the appointment
 * CHECKED_IN, atomically. The advisory lock on the department's day keeps token numbers unique.
 */
async function issueToken(a, officerId) {
  const queueDate = today();
  try {
    return await transaction(async (client) => {
      await lockKey(client, `queue:${a.departmentId}|${queueDate}`);
      const { issued, waiting } = await queueTokens.countForDay(a.departmentId, queueDate, client);
      const departmentCode = await departments.findCode(a.departmentId, client);
      const counterNumber = (await users.findCounterNumber(officerId, client)) ?? 1;
      const tokenNumber = queueTokenNumber(departmentCode, issued + 1);
      if (!(await appointments.markCheckedIn(a.id, tokenNumber, client))) {
        throw new ConflictError("appointment status changed, reload and retry");
      }
      await queueTokens.create({
        id: newId("q"), appointmentId: a.id, tokenNumber, departmentId: a.departmentId, counterNumber,
        officerId: officerId || null, checkedInTime: clockTime(), estimatedMinutesRemaining: 15, queueDate,
      }, client);
      return { tokenNumber, counterNumber, waitingAhead: waiting };
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError("appointment is already checked in");
    throw err;
  }
}

function parseTimeToMinutes(val) {
  if (!val) return 0;
  if (typeof val === "string" && val.includes("T")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(String(val).trim());
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = (m[3] || "").toUpperCase();
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + min;
}


export function createQueueService({ events, audit } = {}) {
  return {
    /** Verifies an APPROVED appointment at the desk and issues today's next queue token. */
    /** req: validated body (validations/queue.validation.js). */
    async checkIn(officer, req) {
      const a = await appointments.findById(req.appointmentId);
      if (!a) throw new NotFoundError();
      if (officer.ability) {
        if (!officer.ability.can("manage", subject("QueueToken", { departmentId: a.departmentId }))) {
          throw new ForbiddenError();
        }
      } else {
        if (officer.departmentId && a.departmentId !== officer.departmentId) throw new ForbiddenError();
      }
      if (a.status !== "APPROVED") {
        throw new ConflictError(`only APPROVED appointments can be checked in (current: ${a.status})`);
      }
      const tok = await issueToken(a, officer.userId);
      events.publish("appointment.checked_in", a.id, { tokenNumber: tok.tokenNumber, counterNumber: tok.counterNumber });
      return {
        tokenNumber: tok.tokenNumber,
        appointmentId: a.id,
        citizenName: a.citizenName,
        serviceName: a.serviceName,
        counterNumber: tok.counterNumber,
        status: "WAITING",
        estimatedWaitMinutes: (tok.waitingAhead + 1) * AVG_SERVICE_MINUTES,
      };
    },

    /**
     * GET /queue/me: the signed-in citizen's place in the queues, today and on later days. For each
     * of their checked-in appointments: token, status, position, citizens ahead, the token being
     * served and an estimated wait; plus their appointments from today on that are not checked in
     * yet (pending, approved, ...), each counted against the other bookings on its own date.
     */
    async mine(caller) {
      const queueDate = today();
      const [tokens, upcoming] = await Promise.all([
        queueTokens.findForCitizen(caller.userId, queueDate),
        appointments.findByCitizen({
          citizenId: caller.userId,
          fromDate: queueDate,
          statuses: ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
        }),
      ]);

      const tokenApptIds = new Set(tokens.map((t) => t.appointment_id));

      // People ahead / behind: the other bookings for the same service on the same date that still
      // the department approved and that are still in the queue (approved, checked in, at the counter),
      // by appointment time. Pending requests are not counted until they are approved.
      const dates = [...new Set([queueDate, ...upcoming.map((a) => a.date), ...tokens.map((t) => t.appointment_date)].filter(Boolean))];
      const booked = await appointments.findHoldingPlaceOn(dates);
      const placeOf = ({ id, serviceId, date, timeSlot, finished, serving, pending }) => {
        if (finished) return { position: null, citizensAhead: 0, citizensBehind: 0, totalInQueue: 0 };
        const mine = parseTimeToMinutes(timeSlot);
        const others = booked.filter((b) => b.id !== id && b.serviceId === serviceId && b.date === date);
        const ahead = serving ? 0 : others.filter((b) => parseTimeToMinutes(b.timeSlot) < mine).length;
        const behind = others.filter((b) => parseTimeToMinutes(b.timeSlot) > mine).length;
        return {
          position: pending ? null : ahead + 1, // a pending booking has no place until it is approved
          citizensAhead: ahead,
          citizensBehind: behind,
          totalInQueue: others.length + 1,
        };
      };

      return {
        date: queueDate,
        averageServiceMinutes: AVG_SERVICE_MINUTES,
        queue: tokens.map((t) => {
          const serving = t.status === "SERVING";
          // Finished at the desk (served or no-show): no longer has a place in the queue.
          const finished = t.status === "COMPLETED" || t.status === "NO_SHOW";
          const place = placeOf({
            id: t.appointment_id, serviceId: t.service_id, date: t.appointment_date, timeSlot: t.time_slot, finished, serving,
          });
          return {
            appointmentId: t.appointment_id,
            referenceNumber: t.reference_number,
            serviceName: t.service_name,
            departmentName: t.department_name,
            appointmentDate: t.appointment_date,
            timeSlot: t.time_slot,
            tokenNumber: t.token_number,
            status: t.status, // WAITING | SERVING | COMPLETED | NO_SHOW
            ...place,
            waitingTotal: place.totalInQueue,
            nowServing: t.now_serving ?? null,
            counterNumber: t.status === "SERVING" ? t.counter_number : null,
            checkedInTime: clock12(t.checked_in_time),
            calledTime: t.called_time ? clock12(t.called_time) : null,
            estimatedWaitMinutes: finished || serving ? 0 : place.citizensAhead * AVG_SERVICE_MINUTES,
            createdAt: t.appointment_created_at,
          };
        }),
        // Appointments from today on that are not checked in (no queue token yet) or were completed directly.
        notCheckedIn: upcoming
          .filter((a) => !tokenApptIds.has(a.id))
          .map((a) => {
            const finished = ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(a.status);
            const serving = a.status === "IN_PROGRESS";
            const pending = a.status === "PENDING";
            const place = placeOf({ id: a.id, serviceId: a.serviceId, date: a.date, timeSlot: a.timeSlot, finished, serving, pending });
            return {
              appointmentId: a.id,
              referenceNumber: a.referenceNumber,
              citizenName: a.citizenName,
              serviceName: a.serviceName,
              departmentName: a.departmentName,
              appointmentDate: a.date,
              timeSlot: a.timeSlot,
              status: a.status,
              ...place,
              estimatedWaitMinutes: finished || serving || pending ? 0 : place.citizensAhead * AVG_SERVICE_MINUTES,
              createdAt: a.createdAt,
            };
          }),
      };
    },

    /** Today's live queue; officers only see their own department. */
    async board(officer, departmentId) {
      const deptId = officer.departmentId || departmentId;
      if (!deptId) invalid("departmentId", "Department is required.");
      const queueDate = today();
      const [serving, waiting] = await Promise.all([
        queueTokens.findServing(deptId, queueDate),
        queueTokens.findWaiting(deptId, queueDate),
      ]);
      const s = serving[0];
      return {
        nowServing: s
          ? { id: s.id, tokenNumber: s.tokenNumber, citizenName: s.citizenName, serviceName: s.serviceName,
            counterNumber: s.counterNumber, calledTime: clock12(s.calledTime), timeSlot: s.timeSlot,
            appointmentDate: s.appointmentDate }
          : null,
        waitingList: waiting.map((t) => ({
          id: t.id, tokenNumber: t.tokenNumber, citizenName: t.citizenName, serviceName: t.serviceName,
          checkedInTime: clock12(t.checkedInTime), estimatedMinutesRemaining: t.estimatedMinutesRemaining,
          timeSlot: t.timeSlot, appointmentDate: t.appointmentDate,
        })),
      };
    },

    /** Calls the oldest WAITING citizen of the officer's department to the officer's counter. */
    async callNext(officer, { counterNumber }) {
      const res = await transaction(async (client) => {
        const tok = await queueTokens.claimNextWaiting(officer.departmentId, today(),
          { counterNumber, officerId: officer.userId || null, calledTime: clockTime() }, client);
        if (!tok) return null;
        const citizenName = await appointments.markInProgress(tok.appointmentId, client);
        return { appointmentId: tok.appointmentId, calledToken: tok.tokenNumber, citizenName, counterNumber };
      });
      if (!res) throw new ConflictError("no citizens are waiting");
      events.publish("appointment.in_progress", res.appointmentId, { tokenNumber: res.calledToken, counterNumber });
      res.chimeText = `Chime: Token ${res.calledToken} please proceed to Counter Desk #${res.counterNumber}`;
      return res;
    },

    /**
     * Closes a WAITING/SERVING token as COMPLETED or NO_SHOW and cascades the status to its appointment.
     * id may be the queue token id or the appointment id. Idempotent: finalizing an appointment that
     * is already COMPLETED/NO_SHOW changes nothing and records no second audit entry (the desk page
     * calls this once with the token id and once with the appointment id).
     */
    async finalize(officer, id, req) {
      const outcome = await transaction(async (client) => {
        let apptId = await queueTokens.finalize(id, officer.departmentId, req.status, client);
        let prev = null;
        if (!apptId) {
          const a = await appointments.findById(id, client);
          if (a && (!officer.departmentId || a.departmentId === officer.departmentId)) {
            prev = a;
            apptId = a.id;
          }
        } else {
          prev = await appointments.findById(apptId, client);
        }
        if (!apptId) throw new NotFoundError();
        if (prev?.status === "PENDING") {
          throw new ConflictError("appointment must be APPROVED before service can be completed");
        }
        if (prev && (prev.status === "REJECTED" || prev.status === "CANCELLED")) {
          throw new ConflictError(`cannot complete service: appointment is ${prev.status.toLowerCase()}`);
        }
        if (prev && FINAL_STATUSES.has(prev.status)) {
          return { appointmentId: apptId, fromStatus: prev.status, alreadyFinal: true };
        }
        await appointments.markFinal(apptId, req.status, client);
        return { appointmentId: apptId, fromStatus: prev?.status ?? null, alreadyFinal: false };
      });
      const { appointmentId } = outcome;
      if (outcome.alreadyFinal) return { id, status: outcome.fromStatus };

      let finalizedApt = null;
      if (appointmentId) {
        finalizedApt = await appointments.findById(appointmentId);
        if (audit && finalizedApt) {
          await audit.record(officer, req.status, finalizedApt, {
            fromStatus: outcome.fromStatus,
            reason: req.status === "COMPLETED" ? "Service completed at counter" : "No-show at counter",
          });
        }
      }
      events.publish(`appointment.${req.status.toLowerCase()}`, appointmentId, {
        queueTokenId: id,
        status: req.status,
        appointmentId,
        citizenId: finalizedApt?.citizenId,
        citizenPhone: finalizedApt?.citizenPhone,
        citizenName: finalizedApt?.citizenName,
        referenceNumber: finalizedApt?.referenceNumber,
        serviceName: finalizedApt?.serviceName,
        departmentName: finalizedApt?.departmentName,
      });
      return { id, status: req.status };
    },
  };
}
