// Appointment use cases (port of the Go service + repository packages).
// Lifecycle events go to Kafka topic woreda.appointments, keyed by appointment id.
import {
  ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError, isDuplicateKey, newId, today,
} from "./lib/index.js";
import { Appointment, departments, services, users } from "./models.js";
import { bookable } from "./catalog.js";
import * as slotStore from "./slots.js";
import {
  BOOK_FIELDS, holdsPlace, nullIfEmpty, optional, referenceNumber, slotKey, stageIndex, strings, summaryRange,
  validateBooking, validateReschedule, validateReview, withRates,
} from "./rules.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (s) => new RegExp(escapeRegex(s), "i"); // ILIKE '%s%'

const SLIP_INSTRUCTIONS = Object.freeze([
  "Arrive 15 minutes before your time slot.",
  "Bring all original required documents.",
  "Present this slip at the reception desk for check-in.",
]);

/** The API shape of an appointment (Go model.Appointment field order; absent optionals are null). */
export function present(d) {
  const n = (v) => v ?? null;
  return {
    id: d._id,
    referenceNumber: d.referenceNumber,
    citizenId: d.citizenId,
    citizenName: d.citizenName,
    citizenPhone: d.citizenPhone,
    citizenEmail: n(d.citizenEmail),
    departmentId: d.departmentId,
    departmentName: d.departmentName ?? "",
    serviceId: d.serviceId,
    serviceName: d.serviceName ?? "",
    date: d.date,
    timeSlot: d.timeSlot,
    status: d.status,
    tokenNumber: n(d.tokenNumber),
    citizenNotes: n(d.citizenNotes),
    officerNotes: n(d.officerNotes),
    rejectionReason: n(d.rejectionReason),
    responsibleOfficerId: n(d.responsibleOfficerId),
    checkedInAt: n(d.checkedInAt),
    completedAt: n(d.completedAt),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** Fills departmentName/serviceName for documents stored without them (looked up by id). */
export async function withNames(docs) {
  const missing = docs.filter((d) => d.departmentName == null || d.serviceName == null);
  if (missing.length === 0) return docs;
  const ids = (key) => [...new Set(missing.map((d) => d[key]))];
  const [depts, svcs] = await Promise.all([
    departments().find({ _id: { $in: ids("departmentId") } }, { projection: { name: 1 } }).toArray(),
    services().find({ _id: { $in: ids("serviceId") } }, { projection: { name: 1 } }).toArray(),
  ]);
  const deptName = new Map(depts.map((d) => [d._id, d.name]));
  const svcName = new Map(svcs.map((s) => [s._id, s.name]));
  return docs.map((d) => ({
    ...d,
    departmentName: d.departmentName ?? deptName.get(d.departmentId) ?? "",
    serviceName: d.serviceName ?? svcName.get(d.serviceId) ?? "",
  }));
}

const presentAll = async (docs) => (await withNames(docs)).map(present);
const presentOne = async (doc) => present((await withNames([doc]))[0]);

export class Appointments {
  /** catalog: { getService(id) }, events: { publish(type, key, data) }, slots: { reserve, release } */
  constructor({ catalog, events, slots = slotStore }) {
    this.catalog = catalog;
    this.events = events;
    this.slots = slots;
  }

  /** POST /appointments: a signed-in caller books for themselves. */
  async book(caller, input) {
    // appointments.citizenId must name a user (a foreign key in the Go schema).
    if (!caller.authenticated) throw new UnauthorizedError("sign in to book an appointment");
    const req = strings(input, BOOK_FIELDS);
    validateBooking(req, today());

    // The service and its department belong to department-service: ask it over gRPC.
    const cs = await this.catalog.getService(req.serviceId);
    if (!bookable(cs)) throw new NotFoundError();
    if (!(await users().findOne({ _id: caller.userId }, { projection: { _id: 1 } }))) {
      throw new UnauthorizedError("user account not found");
    }

    const key = slotKey(req.serviceId, req.date, req.timeSlot);
    await this.slots.reserve(key);
    let doc;
    try {
      doc = await this.#insert({
        citizenId: caller.userId, citizenName: req.citizenName.trim(), citizenPhone: req.citizenPhone,
        citizenEmail: optional(req.citizenEmail), departmentId: cs.departmentId, departmentName: cs.departmentName,
        serviceId: req.serviceId, serviceName: cs.name, date: req.date, timeSlot: req.timeSlot,
        status: "PENDING", citizenNotes: optional(req.citizenNotes),
      });
    } catch (err) {
      await this.slots.release(key);
      throw err;
    }
    const a = present(doc);
    this.events.publish("appointment.booked", a.id, a);
    return a;
  }

  /** Inserts with a fresh id and reference number; a reference collision (1 in 9000 per day) is retried. */
  async #insert(fields) {
    for (let attempt = 1; ; attempt++) {
      try {
        const doc = await Appointment.create({ _id: newId("apt"), referenceNumber: referenceNumber(today()), ...fields });
        return doc.toObject();
      } catch (err) {
        if (!isDuplicateKey(err) || attempt >= 5) throw err;
      }
    }
  }

  /** GET /appointments/track?ref=: latest appointment by reference number or citizen phone. */
  async track(ref) {
    const r = String(ref ?? "").trim();
    if (r === "") {
      new ValidationError().add("ref", "Reference number or phone is required.").throwIfAny();
    }
    const doc = await Appointment.findOne({ $or: [{ referenceNumber: r }, { citizenPhone: r }] })
      .sort({ createdAt: -1 }).lean();
    if (!doc) throw new NotFoundError();
    const a = await presentOne(doc);
    return {
      referenceNumber: a.referenceNumber, citizenName: a.citizenName, serviceName: a.serviceName,
      departmentName: a.departmentName, date: a.date, timeSlot: a.timeSlot, status: a.status,
      tokenNumber: a.tokenNumber, currentStageIndex: stageIndex(a.status), officerNotes: a.officerNotes,
    };
  }

  /** GET /appointments/my: the caller's history for a client tab. */
  async mine(caller, tab, search) {
    const filter = { citizenId: caller.userId };
    switch (String(tab).toUpperCase()) {
      case "UPCOMING":
        filter.date = { $gte: today() };
        filter.status = { $in: ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS"] };
        break;
      case "COMPLETED":
        filter.status = "COMPLETED";
        break;
      case "CANCELLED":
        filter.status = { $in: ["CANCELLED", "REJECTED", "NO_SHOW"] };
        break;
    }
    const s = String(search).trim();
    if (s) filter.$or = [{ referenceNumber: contains(s) }, { serviceName: contains(s) }];
    return presentAll(await Appointment.find(filter).sort({ date: -1, createdAt: -1 }).lean());
  }

  /** GET /appointments: a page of the registry; officers only see their own department. */
  async list(caller, f) {
    const departmentId = caller.role === "OFFICER" ? caller.departmentId : f.departmentId;
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    const status = String(f.status).toUpperCase();
    if (status) filter.status = status;
    switch (String(f.timeframe).toUpperCase()) {
      case "TODAY":
        filter.date = today();
        break;
      case "UPCOMING":
        filter.date = { $gt: today() };
        break;
    }
    if (f.search) {
      const re = contains(f.search);
      filter.$or = [{ citizenName: re }, { referenceNumber: re }, { citizenPhone: re }];
    }
    const [total, docs] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.find(filter).sort({ date: 1, timeSlot: 1, _id: 1 })
        .skip((f.page - 1) * f.limit).limit(f.limit).lean(),
    ]);
    return { items: await presentAll(docs), total };
  }

  /** Fetches an appointment and enforces ownership (citizen) / department (officer) scoping. */
  async #load(caller, id) {
    const a = await Appointment.findById(id).lean();
    if (!a) throw new NotFoundError();
    if (caller.role === "CITIZEN" && a.citizenId !== caller.userId) throw new ForbiddenError();
    if (caller.role === "OFFICER" && a.departmentId !== caller.departmentId) throw new ForbiddenError();
    return a;
  }

  /** PATCH /appointments/:id/status: approve or reject a PENDING appointment. */
  async review(caller, id, input) {
    const u = strings(input, ["status", "officerNotes", "rejectionReason"]);
    validateReview(u);
    await this.#load(caller, id);
    const doc = await Appointment.findOneAndUpdate(
      { _id: id, status: "PENDING" },
      { $set: {
        status: u.status, officerNotes: nullIfEmpty(u.officerNotes), rejectionReason: nullIfEmpty(u.rejectionReason),
        responsibleOfficerId: caller.userId,
      } },
      { new: true, lean: true },
    );
    if (!doc) throw new ConflictError("appointment is not pending review");
    if (u.status === "REJECTED") await this.slots.release(slotKey(doc.serviceId, doc.date, doc.timeSlot));
    const a = await presentOne(doc);
    this.events.publish(`appointment.${u.status.toLowerCase()}`, id, a);
    return a;
  }

  /** POST /appointments/:id/reschedule: moves to a new slot (capacity-checked) and resets to APPROVED. */
  async reschedule(caller, id, input) {
    const req = strings(input, ["newDate", "newTimeSlot", "reason"]);
    validateReschedule(req);
    const prev = await this.#load(caller, id);

    // Take the new place before giving the old one back, so a full slot leaves the booking untouched.
    const newKey = slotKey(prev.serviceId, req.newDate, req.newTimeSlot);
    await this.slots.reserve(newKey);
    const doc = await Appointment.findOneAndUpdate(
      { _id: id, status: prev.status, date: prev.date, timeSlot: prev.timeSlot },
      { $set: { date: req.newDate, timeSlot: req.newTimeSlot, status: "APPROVED" } },
      { new: true, lean: true },
    ).catch(async (err) => {
      await this.slots.release(newKey);
      throw err;
    });
    if (!doc) {
      await this.slots.release(newKey);
      throw new ConflictError("appointment changed while rescheduling; please retry");
    }
    if (holdsPlace(prev.status)) await this.slots.release(slotKey(prev.serviceId, prev.date, prev.timeSlot));

    const a = await presentOne(doc);
    this.events.publish("appointment.rescheduled", id, {
      previousDate: prev.date, previousTimeSlot: prev.timeSlot, reason: req.reason, appointment: a,
    });
    return a;
  }

  /** POST /appointments/:id/cancel: PENDING or APPROVED -> CANCELLED, freeing the slot. */
  async cancel(caller, id) {
    await this.#load(caller, id);
    const doc = await Appointment.findOneAndUpdate(
      { _id: id, status: { $in: ["PENDING", "APPROVED"] } },
      { $set: { status: "CANCELLED" } },
      { new: true, lean: true },
    );
    if (!doc) throw new ConflictError("only pending or approved appointments can be cancelled");
    await this.slots.release(slotKey(doc.serviceId, doc.date, doc.timeSlot));
    this.events.publish("appointment.cancelled", id, null);
  }

  /** GET /appointments/:id/slip: printable slip; room and documents come from the catalog. */
  async slip(id) {
    const doc = await Appointment.findById(id).lean();
    if (!doc) throw new NotFoundError();
    const cs = await this.catalog.getService(doc.serviceId);
    return {
      appointment: await presentOne(doc),
      buildingRoom: cs.buildingRoom,
      // Go decoded an empty repeated field as a nil slice, which encodes as null.
      requiredDocuments: cs.requiredDocuments.length > 0 ? cs.requiredDocuments : null,
      instructions: [...SLIP_INSTRUCTIONS],
      barcode: doc.referenceNumber,
    };
  }

  /** GET /reports/summary: outcomes for appointment dates in the period. */
  async summary(caller, period, departmentId) {
    const deptId = caller.role === "OFFICER" ? caller.departmentId : departmentId;
    const { from, to } = summaryRange(period, today());
    const match = { date: { $gte: from, $lt: to } };
    if (deptId) match.departmentId = deptId;
    const count = (status) => ({ $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } });
    const [row] = await Appointment.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: 1 }, completed: count("COMPLETED"), noShow: count("NO_SHOW"), cancelled: count("CANCELLED") } },
    ]);
    return withRates({
      totalAppointments: row?.total ?? 0,
      completedAppointments: row?.completed ?? 0,
      noShowAppointments: row?.noShow ?? 0,
      cancelledAppointments: row?.cancelled ?? 0,
    });
  }
}
