// The desk queue: check-in, live board, call-next and finalize (Go service/queue_service.go +
// repository/queue_repository.go). Each step that changes a queue token also moves its appointment
// in the same transaction, and announces it on Kafka (topic woreda.appointments).
import mongoose from "mongoose";
import {
  ConflictError, ForbiddenError, NotFoundError, ValidationError, clockTime, isDuplicateKey, newId, today,
} from "./lib/index.js";
import { QueueToken, appointments, departments, queueCounters, services, users } from "./models.js";
import { AVG_SERVICE_MINUTES, clock12, decodeCallNext, decodeCheckIn, decodeFinalize, queueToken } from "./rules.js";

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

export class Queue {
  constructor(events) {
    this.events = events;
  }

  /** Verifies an APPROVED appointment at the desk and issues today's next queue token. */
  async checkIn(officer, input) {
    const req = decodeCheckIn(input);
    if (!req.appointmentId) {
      new ValidationError().add("appointmentId", "Appointment id is required.").throwIfAny();
    }
    const a = await this.#checkInAppointment(req.appointmentId);
    if (officer.departmentId && a.departmentId !== officer.departmentId) throw new ForbiddenError();
    if (a.status !== "APPROVED") {
      throw new ConflictError(`only APPROVED appointments can be checked in (current: ${a.status})`);
    }
    // TODO (as in Go): persist req.verifiedDocuments / req.notes (e.g. officerNotes or an audit event).
    const tok = await this.#issueToken(a, officer.userId);
    this.events.publish("appointment.checked_in", a.id, {
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
  }

  /** Appointment joined with its department code and service name (404 if any is missing, as the Go JOIN). */
  async #checkInAppointment(id) {
    const a = await appointments().findOne(
      { _id: id },
      { projection: { status: 1, departmentId: 1, serviceId: 1, citizenName: 1 } },
    );
    if (!a) throw new NotFoundError();
    const [d, s] = await Promise.all([
      departments().findOne({ _id: a.departmentId }, { projection: { code: 1 } }),
      services().findOne({ _id: a.serviceId }, { projection: { name: 1 } }),
    ]);
    if (!d || !s) throw new NotFoundError();
    return {
      id: a._id, status: a.status, departmentId: a.departmentId, departmentCode: d.code ?? "",
      citizenName: a.citizenName ?? "", serviceName: s.name ?? "",
    };
  }

  /**
   * Creates today's next sequential token ({DEPT_CODE}-{count+1:02d}) and marks the appointment
   * CHECKED_IN, atomically. The first write bumps the department's daily lock document, so
   * concurrent check-ins conflict and are retried in turn (Go: pg_advisory_xact_lock).
   */
  async #issueToken(a, officerId) {
    const queueDate = today();
    try {
      return await inTransaction(async (session) => {
        await queueCounters().updateOne(
          { _id: `${a.departmentId}|${queueDate}` },
          { $inc: { seq: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true, session },
        );
        // Sequential on purpose: operations of one transaction should not run concurrently.
        const issued = await QueueToken.countDocuments({ departmentId: a.departmentId, queueDate }).session(session);
        const waitingAhead = await QueueToken.countDocuments({ departmentId: a.departmentId, queueDate, status: "WAITING" }).session(session);
        const officer = await users().findOne({ _id: officerId }, { projection: { counterNumber: 1 }, session });
        const tokenNumber = queueToken(a.departmentCode, issued + 1);
        const counterNumber = officer?.counterNumber ?? 1;
        const now = new Date();
        const res = await appointments().updateOne(
          { _id: a.id, status: "APPROVED" },
          { $set: { status: "CHECKED_IN", tokenNumber, checkedInAt: now, updatedAt: now } },
          { session },
        );
        if (res.matchedCount === 0) throw new ConflictError("appointment status changed, reload and retry");
        await QueueToken.create(
          [{
            _id: newId("q"), appointmentId: a.id, tokenNumber, departmentId: a.departmentId, counterNumber,
            officerId: officerId || null, status: "WAITING", checkedInTime: clockTime(now), calledTime: null,
            estimatedMinutesRemaining: 15, queueDate,
          }],
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

  /** Today's live queue; officers only see their own department. */
  async board(officer, departmentId) {
    const deptId = officer.departmentId || departmentId;
    if (!deptId) new ValidationError().add("departmentId", "Department is required.").throwIfAny();
    const queueDate = today();
    const [serving, waiting] = await Promise.all([
      QueueToken.find({ departmentId: deptId, queueDate, status: "SERVING" }).sort({ calledTime: -1 }).lean(),
      QueueToken.find({ departmentId: deptId, queueDate, status: "WAITING" }).sort({ createdAt: 1, _id: 1 }).lean(),
    ]);
    const names = await this.#names([...serving, ...waiting]);
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
  }

  /** appointmentId -> {citizenName, serviceName} for tokens whose appointment and service exist. */
  async #names(tokens) {
    const appts = await appointments()
      .find({ _id: { $in: tokens.map((t) => t.appointmentId) } }, { projection: { citizenName: 1, serviceId: 1 } })
      .toArray();
    const srvs = await services()
      .find({ _id: { $in: [...new Set(appts.map((a) => a.serviceId))] } }, { projection: { name: 1 } })
      .toArray();
    const srvName = new Map(srvs.map((s) => [s._id, s.name ?? ""]));
    const out = new Map();
    for (const a of appts) {
      if (srvName.has(a.serviceId)) out.set(a._id, { citizenName: a.citizenName ?? "", serviceName: srvName.get(a.serviceId) });
    }
    return out;
  }

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
      const tok = await QueueToken.collection.findOneAndUpdate(
        { departmentId: officer.departmentId, queueDate: today(), status: "WAITING" },
        { $set: { status: "SERVING", counterNumber: counter, officerId: officer.userId || null, calledTime: clockTime(), updatedAt: new Date() } },
        { sort: { createdAt: 1, _id: 1 }, returnDocument: "after", session },
      );
      if (!tok) return null;
      const appt = await appointments().findOneAndUpdate(
        { _id: tok.appointmentId },
        { $set: { status: "IN_PROGRESS", updatedAt: new Date() } },
        { projection: { citizenName: 1 }, session },
      );
      return {
        appointmentId: tok.appointmentId, calledToken: tok.tokenNumber, citizenName: appt?.citizenName ?? "",
        counterNumber: counter,
      };
    });
    if (!res) throw new ConflictError("no citizens are waiting");
    this.events.publish("appointment.in_progress", res.appointmentId, {
      tokenNumber: res.calledToken, counterNumber: res.counterNumber, officerId: officer.userId,
    });
    res.chimeText = `Chime: Token ${res.calledToken} please proceed to Counter Desk #${res.counterNumber}`;
    return res;
  }

  /** Closes a WAITING/SERVING token as COMPLETED or NO_SHOW and cascades the status to its appointment. */
  async finalize(officer, id, input) {
    const req = decodeFinalize(input);
    if (req.status !== "COMPLETED" && req.status !== "NO_SHOW") {
      new ValidationError().add("status", "Status must be COMPLETED or NO_SHOW.").throwIfAny();
    }
    const appointmentId = await inTransaction(async (session) => {
      const filter = { _id: id, status: { $in: ["WAITING", "SERVING"] } };
      if (officer.departmentId) filter.departmentId = officer.departmentId;
      const tok = await QueueToken.collection.findOneAndUpdate(
        filter,
        { $set: { status: req.status, updatedAt: new Date() } },
        { projection: { appointmentId: 1 }, session },
      );
      if (!tok) throw new NotFoundError();
      const now = new Date();
      const set = { status: req.status, updatedAt: now };
      if (req.status === "COMPLETED") set.completedAt = now;
      await appointments().updateOne({ _id: tok.appointmentId }, { $set: set }, { session });
      return tok.appointmentId;
    });
    this.events.publish(`appointment.${req.status.toLowerCase()}`, appointmentId, { queueTokenId: id, officerId: officer.userId });
    return { id, status: req.status };
  }
}
