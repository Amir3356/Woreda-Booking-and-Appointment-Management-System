// Appointment use cases (port of the Go service package): validation, booking with slot capacity,
// tracking, history, registry, review, reschedule, cancel and slip.
// Lifecycle events go to Kafka topic woreda.appointments, keyed by appointment id.
import {
  BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError, isDuplicateKey,
} from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { isTimeSlot, nowMinutes, today, validDate } from "../utils/date.js";
import { normalizePage, pagination } from "../utils/pagination.js";
import { holdsPlace, present, referenceNumber, slotKey, stageIndex } from "../utils/appointment.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as users from "../repositories/user.repository.js";
import * as schedules from "../repositories/schedule.repository.js";
import { scheduleIssue, slotMinutes } from "../utils/schedule.js";
import { bookingRefusals } from "./slot.service.js";

const ethiopianPhone = /^\+2519\d{8}$/;

const SLIP_INSTRUCTIONS = Object.freeze([
  "Arrive 15 minutes before your time slot.",
  "Bring all original required documents.",
  "Present this slip at the reception desk for check-in.",
]);

/** Trimmed value, or null when blank (Go's optional()). */
const optional = (s) => (s.trim() === "" ? null : s.trim());
/** NULLIF(s, '') */
const nullIfEmpty = (s) => (s === "" ? null : s);

/** Reads string fields like Go's JSON decoder into a struct of strings: missing/null -> "", other types -> 400. */
export function strings(input, keys) {
  const out = {};
  for (const k of keys) {
    const v = input[k];
    if (v == null) out[k] = "";
    else if (typeof v === "string") out[k] = v;
    else throw new BadRequestError(`malformed JSON body: json: cannot unmarshal ${jsonType(v)} into field ${k} of type string`);
  }
  return out;
}
const jsonType = (v) => (Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v);

export const BOOK_FIELDS = ["citizenName", "citizenPhone", "citizenEmail", "departmentId", "serviceId", "date", "timeSlot", "citizenNotes"];

export function validateBooking(req, todayStr) {
  const v = new ValidationError();
  if (req.citizenName.trim().length < 3) v.add("citizenName", "Citizen name is required (min 3 characters).");
  if (!ethiopianPhone.test(req.citizenPhone)) v.add("citizenPhone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  if (req.serviceId === "") v.add("serviceId", "Service is required.");
  if (!validDate(req.date)) v.add("date", "Date must be YYYY-MM-DD.");
  else if (req.date < todayStr) v.add("date", "Date cannot be in the past.");
  if (!isTimeSlot(req.timeSlot)) v.add("timeSlot", 'Time slot must look like "09:00 AM".');
  v.throwIfAny();
}

export function validateReview(u) {
  const v = new ValidationError();
  if (u.status !== "APPROVED" && u.status !== "REJECTED") v.add("status", "Status must be APPROVED or REJECTED.");
  if (u.status === "REJECTED" && u.rejectionReason.trim() === "") v.add("rejectionReason", "A rejection reason is required.");
  v.throwIfAny();
}

export function validateReschedule(req) {
  const v = new ValidationError();
  if (!validDate(req.newDate)) v.add("newDate", "Date must be YYYY-MM-DD.");
  if (!isTimeSlot(req.newTimeSlot)) v.add("newTimeSlot", 'Time slot must look like "09:00 AM".');
  v.throwIfAny();
}

/** Whether citizens can book this catalog service right now. */
export const bookable = (cs) => cs.active && cs.departmentActive;

/** Fills departmentName/serviceName for documents stored without them (looked up by id). */
async function withNames(docs) {
  const missing = docs.filter((d) => d.departmentName == null || d.serviceName == null);
  if (missing.length === 0) return docs;
  const ids = (key) => [...new Set(missing.map((d) => d[key]))];
  const { departmentNames, serviceNames } = await appointments.findNames(ids("departmentId"), ids("serviceId"));
  return docs.map((d) => ({
    ...d,
    departmentName: d.departmentName ?? departmentNames.get(d.departmentId) ?? "",
    serviceName: d.serviceName ?? serviceNames.get(d.serviceId) ?? "",
  }));
}

const presentAll = async (docs) => (await withNames(docs)).map(present);
const presentOne = async (doc) => present((await withNames([doc]))[0]);

/** catalog: { getService(id) }, events: { publish(type, key, data) }, slots: { reserve, release, reserveDay, releaseDay } */
export function createAppointmentService({ catalog, events, slots, audit = { record: async () => {} } }) {
  /**
   * The schedule (Admin > Schedule Management) must allow the date and time; returns it.
   * field names the request field for the 422 ("date"/"timeSlot", or "newDate"/"newTimeSlot").
   */
  async function requireOpen(serviceId, departmentId, date, timeSlot, fields = { date: "date", timeSlot: "timeSlot" }) {
    const schedule = await schedules.findActive(serviceId, departmentId, date);
    const issue = scheduleIssue(schedule, date, timeSlot);
    if (issue) {
      bookingRefusals.inc({ reason: "SCHEDULE_CLOSED" });
      new ValidationError().add(fields[issue.field], issue.issue).throwIfAny();
    }
    // Today, a time that has already started can no longer be booked.
    if (date === today() && slotMinutes(timeSlot) <= nowMinutes()) {
      bookingRefusals.inc({ reason: "TIME_PASSED" });
      new ValidationError().add(fields.timeSlot, "That time has already passed today. Choose a later time or another date.").throwIfAny();
    }
    return schedule;
  }

  /** Takes a place in the day (daily capacity) and in the time slot, or neither. */
  async function takePlaces(serviceId, date, timeSlot, schedule) {
    await slots.reserveDay(serviceId, date, schedule.dailyCapacity);
    try {
      await slots.reserve(slotKey(serviceId, date, timeSlot), schedule);
    } catch (err) {
      await slots.releaseDay(serviceId, date);
      throw err;
    }
  }

  /** Gives back the places an appointment held. */
  async function releasePlaces(doc) {
    await slots.release(slotKey(doc.serviceId, doc.date, doc.timeSlot));
    await slots.releaseDay(doc.serviceId, doc.date);
  }

  /** Inserts with a fresh id and reference number; a reference collision (1 in 9000 per day) is retried. */
  async function insert(fields) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await appointments.create({ _id: newId("apt"), referenceNumber: referenceNumber(today()), ...fields });
      } catch (err) {
        if (!isDuplicateKey(err) || attempt >= 5) throw err;
      }
    }
  }

  /** Fetches an appointment and enforces ownership (citizen) / department (officer) scoping. */
  async function load(caller, id) {
    const a = await appointments.findById(id);
    if (!a) throw new NotFoundError();
    if (caller.role === "CITIZEN" && a.citizenId !== caller.userId) throw new ForbiddenError();
    if (caller.role === "OFFICER" && a.departmentId !== caller.departmentId) throw new ForbiddenError();
    return a;
  }

  const service = {
    /** POST /appointments: a signed-in caller books for themselves. */
    async book(caller, input) {
      // appointments.citizenId must name a user (a foreign key in the Go schema).
      if (!caller.authenticated) throw new UnauthorizedError("sign in to book an appointment");
      const req = strings(input, BOOK_FIELDS);
      validateBooking(req, today());

      // The service and its department belong to department-service: ask it over gRPC.
      const cs = await catalog.getService(req.serviceId);
      if (!bookable(cs)) throw new NotFoundError();
      if (!(await users.exists(caller.userId))) {
        throw new UnauthorizedError("user account not found");
      }

      // Working days, opening hours and daily capacity set by the Admin for this service.
      const schedule = await requireOpen(req.serviceId, cs.departmentId, req.date, req.timeSlot);
      await takePlaces(req.serviceId, req.date, req.timeSlot, schedule);
      let doc;
      try {
        doc = await insert({
          citizenId: caller.userId, citizenName: req.citizenName.trim(), citizenPhone: req.citizenPhone,
          citizenEmail: optional(req.citizenEmail), departmentId: cs.departmentId, departmentName: cs.departmentName,
          serviceId: req.serviceId, serviceName: cs.name, date: req.date, timeSlot: req.timeSlot,
          status: "PENDING", citizenNotes: optional(req.citizenNotes),
        });
      } catch (err) {
        await releasePlaces({ serviceId: req.serviceId, date: req.date, timeSlot: req.timeSlot });
        throw err;
      }
      const a = present(doc);
      await audit.record(caller, "BOOKED", a);
      events.publish("appointment.booked", a.id, a);
      return a;
    },

    /** GET /appointments/track?ref=: latest appointment by reference number or citizen phone. */
    async track(ref) {
      const r = String(ref ?? "").trim();
      if (r === "") {
        new ValidationError().add("ref", "Reference number or phone is required.").throwIfAny();
      }
      const doc = await appointments.findLatestByReferenceOrPhone(r);
      if (!doc) throw new NotFoundError();
      const a = await presentOne(doc);
      return {
        referenceNumber: a.referenceNumber, citizenName: a.citizenName, serviceName: a.serviceName,
        departmentName: a.departmentName, date: a.date, timeSlot: a.timeSlot, status: a.status,
        tokenNumber: a.tokenNumber, currentStageIndex: stageIndex(a.status), officerNotes: a.officerNotes,
      };
    },

    /** GET /appointments/my: the caller's history for a client tab. */
    async mine(caller, tab, search) {
      const filter = { citizenId: caller.userId };
      switch (String(tab).toUpperCase()) {
        case "UPCOMING":
          filter.fromDate = today();
          filter.status = ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS"];
          break;
        case "COMPLETED":
          filter.status = "COMPLETED";
          break;
        case "CANCELLED":
          filter.status = ["CANCELLED", "REJECTED", "NO_SHOW"];
          break;
      }
      filter.search = String(search).trim();
      return presentAll(await appointments.findByCitizen(filter));
    },

    /** A page of the registry; officers only see their own department. f.page/f.limit must be normalized. */
    async list(caller, f) {
      const departmentId = caller.role === "OFFICER" ? caller.departmentId : f.departmentId;
      const filter = { departmentId, status: String(f.status).toUpperCase(), search: f.search };
      switch (String(f.timeframe).toUpperCase()) {
        case "TODAY":
          filter.date = today();
          break;
        case "UPCOMING":
          filter.afterDate = today();
          break;
      }
      const { docs, total } = await appointments.findPage(filter, { page: f.page, limit: f.limit });
      return { items: await presentAll(docs), total };
    },

    /** GET /appointments: page/limit normalized (page >= 1, limit 1..200 else 20) plus pagination meta. */
    async listPage(caller, f) {
      const { page, limit } = normalizePage(f.page, f.limit);
      const { items, total } = await service.list(caller, { ...f, page, limit });
      return { items, pagination: pagination(total, page, limit) };
    },

    /** PATCH /appointments/:id/status: approve or reject a PENDING appointment. */
    async review(caller, id, input) {
      const u = strings(input, ["status", "officerNotes", "rejectionReason"]);
      validateReview(u);
      await load(caller, id);
      const doc = await appointments.updateIf(id, { status: "PENDING" }, {
        status: u.status, officerNotes: nullIfEmpty(u.officerNotes), rejectionReason: nullIfEmpty(u.rejectionReason),
        responsibleOfficerId: caller.userId,
      });
      if (!doc) throw new ConflictError("appointment is not pending review");
      if (u.status === "REJECTED") await releasePlaces(doc);
      const a = await presentOne(doc);
      await audit.record(caller, u.status, a, {
        fromStatus: "PENDING",
        reason: u.status === "REJECTED" ? u.rejectionReason : u.officerNotes,
      });
      events.publish(`appointment.${u.status.toLowerCase()}`, id, a);
      return a;
    },

    /** POST /appointments/:id/reschedule: moves to a new slot (capacity-checked) and resets to APPROVED. */
    async reschedule(caller, id, input) {
      const req = strings(input, ["newDate", "newTimeSlot", "reason"]);
      validateReschedule(req);
      const prev = await load(caller, id);

      // Take the new places before giving the old ones back, so a full slot or day leaves the
      // booking untouched. The new date and time must be open in the service's schedule.
      const schedule = await requireOpen(prev.serviceId, prev.departmentId, req.newDate, req.newTimeSlot,
        { date: "newDate", timeSlot: "newTimeSlot" });
      const moved = { serviceId: prev.serviceId, date: req.newDate, timeSlot: req.newTimeSlot };
      await takePlaces(prev.serviceId, req.newDate, req.newTimeSlot, schedule);
      const doc = await appointments.updateIf(
        id,
        { status: prev.status, date: prev.date, timeSlot: prev.timeSlot },
        { date: req.newDate, timeSlot: req.newTimeSlot, status: "APPROVED" },
      ).catch(async (err) => {
        await releasePlaces(moved);
        throw err;
      });
      if (!doc) {
        await releasePlaces(moved);
        throw new ConflictError("appointment changed while rescheduling; please retry");
      }
      if (holdsPlace(prev.status)) await releasePlaces(prev);

      const a = await presentOne(doc);
      await audit.record(caller, "RESCHEDULED", a, {
        fromStatus: prev.status,
        reason: `${prev.date} ${prev.timeSlot} -> ${a.date} ${a.timeSlot}${req.reason ? `: ${req.reason}` : ""}`,
      });
      events.publish("appointment.rescheduled", id, {
        previousDate: prev.date, previousTimeSlot: prev.timeSlot, reason: req.reason, appointment: a,
      });
      return a;
    },

    /** POST /appointments/:id/cancel: PENDING or APPROVED -> CANCELLED, freeing the slot. */
    /**
     * POST /appointments/:id/cancel. A citizen may cancel only while the booking is PENDING: once a
     * department officer has approved it, it stays. Officers and the administrator can still cancel
     * PENDING or APPROVED appointments.
     */
    async cancel(caller, id) {
      const prev = await load(caller, id);
      const isCitizen = caller.role === "CITIZEN";
      const allowed = isCitizen ? ["PENDING"] : ["PENDING", "APPROVED"];
      const doc = await appointments.updateIf(id, { status: { $in: allowed } }, { status: "CANCELLED" });
      if (!doc) {
        throw new ConflictError(
          isCitizen && prev.status === "APPROVED"
            ? "an approved appointment can no longer be cancelled by the citizen"
            : isCitizen
              ? "only pending appointments can be cancelled"
              : "only pending or approved appointments can be cancelled",
        );
      }
      await releasePlaces(doc);
      await audit.record(caller, "CANCELLED", await presentOne(doc), { fromStatus: prev.status });
      events.publish("appointment.cancelled", id, null);
      return { id, status: "CANCELLED" };
    },

    /** GET /appointments/:id/slip: printable slip; room and documents come from the catalog. */
    async slip(id) {
      const doc = await appointments.findById(id);
      if (!doc) throw new NotFoundError();
      const cs = await catalog.getService(doc.serviceId);
      return {
        appointment: await presentOne(doc),
        buildingRoom: cs.buildingRoom,
        // Go decoded an empty repeated field as a nil slice, which encodes as null.
        requiredDocuments: cs.requiredDocuments.length > 0 ? cs.requiredDocuments : null,
        instructions: [...SLIP_INSTRUCTIONS],
        barcode: doc.referenceNumber,
      };
    },
  };
  return service;
}
