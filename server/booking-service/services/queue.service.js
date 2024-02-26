// The desk queue (Go service/queue_service.go + repository/queue_repository.go): check-in, live
// board, call-next and finalize. Each step that changes a queue token also moves its appointment in
// the same transaction (owned here), and announces it on Kafka (topic woreda.appointments).
import mongoose from "mongoose";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { clock12, clockTime, today } from "../utils/time.js";
import { AVG_SERVICE_MINUTES, queueToken } from "../utils/queueToken.js";
import { decodeCallNext, decodeCheckIn, decodeFinalize } from "../utils/decode.js";
import * as queueTokens from "../repositories/queueToken.repository.js";
import * as queueCounters from "../repositories/queueCounter.repository.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as catalog from "../repositories/catalog.repository.js";

/** Runs fn(session) in a transaction (retried on transient write conflicts) and returns its result. */
async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Appointment joined with its department code and service name (404 if any is missing, as the Go JOIN). */
async function checkInAppointment(id) {
  const a = await appointments.findForCheckIn(id);
  if (!a) throw new NotFoundError();
  const [departmentCode, serviceName] = await Promise.all([
    catalog.findDepartmentCode(a.departmentId),
    catalog.findServiceName(a.serviceId),
  ]);
  if (departmentCode === null || serviceName === null) throw new NotFoundError();
  return {
    id: a._id, status: a.status, departmentId: a.departmentId, departmentCode,
    citizenName: a.citizenName ?? "", serviceName,
  };
}

/**
 * Creates today's next sequential token ({DEPT_CODE}-{count+1:02d}) and marks the appointment
 * CHECKED_IN, atomically. The first write bumps the department's daily lock document, so
 * concurrent check-ins conflict and are retried in turn (Go: pg_advisory_xact_lock).
 */
async function issueToken(a, officerId) {
  const queueDate = today();
  try {
    return await inTransaction(async (session) => {
      await queueCounters.lockDay(a.departmentId, queueDate, { session });
      // Sequential on purpose: operations of one transaction should not run concurrently.
      const issued = await queueTokens.countIssued(a.departmentId, queueDate, { session });
      const waitingAhead = await queueTokens.countWaiting(a.departmentId, queueDate, { session });
      const counter = await catalog.findOfficerCounter(officerId, { session });
      const tokenNumber = queueToken(a.departmentCode, issued + 1);
      const counterNumber = counter ?? 1;
      const now = new Date();
      if (!(await appointments.markCheckedIn(a.id, tokenNumber, now, { session }))) {
        throw new ConflictError("appointment status changed, reload and retry");
      }
      await queueTokens.create(
        {
          _id: newId("q"), appointmentId: a.id, tokenNumber, departmentId: a.departmentId, counterNumber,
          officerId: officerId || null, status: "WAITING", checkedInTime: clockTime(now), calledTime: null,
          estimatedMinutesRemaining: 15, queueDate,
        },
        { session },
      );
      return { tokenNumber, counterNumber, waitingAhead };
    });
  } catch (err) {
    // Unique appointmentId: the appointment already has a queue token (Go: 500 from the UNIQUE constraint).
    if (isDuplicateKey(err)) throw new ConflictError("appointment is already checked in");
    throw err;
  }
}

/** appointmentId -> {citizenName, serviceName} for tokens whose appointment and service exist. */
async function namesFor(tokens) {
  const appts = await appointments.findCitizens(tokens.map((t) => t.appointmentId));
  const srvName = await catalog.findServiceNames([...new Set(appts.map((a) => a.serviceId))]);
  const out = new Map();
  for (const a of appts) {
    if (srvName.has(a.serviceId)) out.set(a._id, { citizenName: a.citizenName ?? "", serviceName: srvName.get(a.serviceId) });
  }
  return out;
}

export function createQueueService({ events }) {
  return {
    /** Verifies an APPROVED appointment at the desk and issues today's next queue token. */
    async checkIn(officer, input) {
      const req = decodeCheckIn(input);
      if (!req.appointmentId) {
        new ValidationError().add("appointmentId", "Appointment id is required.").throwIfAny();
      }
      const a = await checkInAppointment(req.appointmentId);
      if (officer.departmentId && a.departmentId !== officer.departmentId) throw new ForbiddenError();
      if (a.status !== "APPROVED") {
        throw new ConflictError(`only APPROVED appointments can be checked in (current: ${a.status})`);
      }
      // TODO (as in Go): persist req.verifiedDocuments / req.notes (e.g. officerNotes or an audit event).
      const tok = await issueToken(a, officer.userId);
      events.publish("appointment.checked_in", a.id, {
        tokenNumber: tok.tokenNumber, counterNumber: tok.counterNumber, departmentId: a.departmentId, officerId: officer.userId,
      });
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
      if (!deptId) new ValidationError().add("departmentId", "Department is required.").throwIfAny();
      const queueDate = today();
      const [serving, waiting] = await Promise.all([
        queueTokens.findServing(deptId, queueDate),
        queueTokens.findWaiting(deptId, queueDate),
      ]);
      const names = await namesFor([...serving, ...waiting]);
      const board = { nowServing: null, waitingList: [] };
      // Go INNER JOINed appointments and services: tokens without them are not shown.
      const s = serving.find((t) => names.has(t.appointmentId));
      if (s) {
        const n = names.get(s.appointmentId);
        board.nowServing = {
          id: s._id, tokenNumber: s.tokenNumber, citizenName: n.citizenName, serviceName: n.serviceName,
          counterNumber: s.counterNumber, calledTime: clock12(s.calledTime),
        };
      }
      for (const t of waiting) {
        const n = names.get(t.appointmentId);
        if (!n) continue;
        board.waitingList.push({
          id: t._id, tokenNumber: t.tokenNumber, citizenName: n.citizenName, serviceName: n.serviceName,
          checkedInTime: clock12(t.checkedInTime), estimatedMinutesRemaining: t.estimatedMinutesRemaining,
        });
      }
      return board;
    },

    /**
     * Calls the oldest WAITING citizen of the officer's department to the officer's counter. The
     * token is claimed with one atomic findOneAndUpdate inside the transaction (Go: FOR UPDATE SKIP
     * LOCKED), so two officers never call the same citizen; a losing transaction retries on the next one.
     */
    async callNext(officer, input) {
      const req = decodeCallNext(input);
      if (req.counterNumber <= 0) {
        new ValidationError().add("counterNumber", "Counter number must be positive.").throwIfAny();
      }
      const counter = req.counterNumber;
      const res = await inTransaction(async (session) => {
        const tok = await queueTokens.claimNextWaiting(
          officer.departmentId, today(),
          { counterNumber: counter, officerId: officer.userId || null, calledTime: clockTime() },
          { session },
        );
        if (!tok) return null;
        const citizenName = await appointments.markInProgress(tok.appointmentId, { session });
        return { appointmentId: tok.appointmentId, calledToken: tok.tokenNumber, citizenName, counterNumber: counter };
      });
      if (!res) throw new ConflictError("no citizens are waiting");
      events.publish("appointment.in_progress", res.appointmentId, {
        tokenNumber: res.calledToken, counterNumber: res.counterNumber, officerId: officer.userId,
      });
      res.chimeText = `Chime: Token ${res.calledToken} please proceed to Counter Desk #${res.counterNumber}`;
      return res;
    },

    /** Closes a WAITING/SERVING token as COMPLETED or NO_SHOW and cascades the status to its appointment. */
    async finalize(officer, id, input) {
      const req = decodeFinalize(input);
      if (req.status !== "COMPLETED" && req.status !== "NO_SHOW") {
        new ValidationError().add("status", "Status must be COMPLETED or NO_SHOW.").throwIfAny();
      }
      const appointmentId = await inTransaction(async (session) => {
        const tok = await queueTokens.finalize(id, officer.departmentId, req.status, { session });
        if (!tok) throw new NotFoundError();
        await appointments.markFinal(tok.appointmentId, req.status, { session });
        return tok.appointmentId;
      });
      events.publish(`appointment.${req.status.toLowerCase()}`, appointmentId, { queueTokenId: id, officerId: officer.userId });
      return { id, status: req.status };
    },
  };
}
