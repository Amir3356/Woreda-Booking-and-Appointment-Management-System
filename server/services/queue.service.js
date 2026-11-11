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

export function createQueueService({ events }) {
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
            counterNumber: s.counterNumber, calledTime: clock12(s.calledTime) }
          : null,
        waitingList: waiting.map((t) => ({
          id: t.id, tokenNumber: t.tokenNumber, citizenName: t.citizenName, serviceName: t.serviceName,
          checkedInTime: clock12(t.checkedInTime), estimatedMinutesRemaining: t.estimatedMinutesRemaining,
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

    /** Closes a WAITING/SERVING token as COMPLETED or NO_SHOW and cascades the status to its appointment. */
    async finalize(officer, id, req) {
      const appointmentId = await transaction(async (client) => {
        const apptId = await queueTokens.finalize(id, officer.departmentId, req.status, client);
        if (!apptId) throw new NotFoundError();
        await appointments.markFinal(apptId, req.status, client);
        return apptId;
      });
      events.publish(`appointment.${req.status.toLowerCase()}`, appointmentId, { queueTokenId: id });
      return { id, status: req.status };
    },
  };
}
