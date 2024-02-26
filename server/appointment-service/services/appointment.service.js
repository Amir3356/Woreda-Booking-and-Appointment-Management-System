// Appointment use cases (port of the Go service package): validation, booking with slot capacity,
// tracking, history, registry, review, reschedule, cancel and slip.
// Lifecycle events go to Kafka topic woreda.appointments, keyed by appointment id.
import {
  BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError, isDuplicateKey,
} from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { isTimeSlot, today, validDate } from "../utils/date.js";
import { normalizePage, pagination } from "../utils/pagination.js";
import { holdsPlace, present, referenceNumber, slotKey, stageIndex } from "../utils/appointment.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as users from "../repositories/user.repository.js";

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

/** catalog: { getService(id) }, events: { publish(type, key, data) }, slots: { reserve, release } */
export function createAppointmentService({ catalog, events, slots }) {
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

      const key = slotKey(req.serviceId, req.date, req.timeSlot);
      await slots.reserve(key);
      let doc;
      try {
        doc = await insert({
          citizenId: caller.userId, citizenName: req.citizenName.trim(), citizenPhone: req.citizenPhone,
          citizenEmail: optional(req.citizenEmail), departmentId: cs.departmentId, departmentName: cs.departmentName,
          serviceId: req.serviceId, serviceName: cs.name, date: req.date, timeSlot: req.timeSlot,
          status: "PENDING", citizenNotes: optional(req.citizenNotes),
        });
      } catch (err) {
        await slots.release(key);
        throw err;
      }
      const a = present(doc);
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
      if (u.status === "REJECTED") await slots.release(slotKey(doc.serviceId, doc.date, doc.timeSlot));
      const a = await presentOne(doc);
      events.publish(`appointment.${u.status.toLowerCase()}`, id, a);
      return a;
    },

    /** POST /appointments/:id/reschedule: moves to a new slot (capacity-checked) and resets to APPROVED. */
    async reschedule(caller, id, input) {
      const req = strings(input, ["newDate", "newTimeSlot", "reason"]);
      validateReschedule(req);
      const prev = await load(caller, id);

      // Take the new place before giving the old one back, so a full slot leaves the booking untouched.
      const newKey = slotKey(prev.serviceId, req.newDate, req.newTimeSlot);
      await slots.reserve(newKey);
      const doc = await appointments.updateIf(
        id,
        { status: prev.status, date: prev.date, timeSlot: prev.timeSlot },
        { date: req.newDate, timeSlot: req.newTimeSlot, status: "APPROVED" },
      ).catch(async (err) => {
        await slots.release(newKey);
        throw err;
      });
      if (!doc) {
        await slots.release(newKey);
        throw new ConflictError("appointment changed while rescheduling; please retry");
      }
      if (holdsPlace(prev.status)) await slots.release(slotKey(prev.serviceId, prev.date, prev.timeSlot));

      const a = await presentOne(doc);
      events.publish("appointment.rescheduled", id, {
        previousDate: prev.date, previousTimeSlot: prev.timeSlot, reason: req.reason, appointment: a,
      });
      return a;
    },

    /** POST /appointments/:id/cancel: PENDING or APPROVED -> CANCELLED, freeing the slot. */
    async cancel(caller, id) {
      await load(caller, id);
      const doc = await appointments.updateIf(id, { status: { $in: ["PENDING", "APPROVED"] } }, { status: "CANCELLED" });
      if (!doc) throw new ConflictError("only pending or approved appointments can be cancelled");
      await slots.release(slotKey(doc.serviceId, doc.date, doc.timeSlot));
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
