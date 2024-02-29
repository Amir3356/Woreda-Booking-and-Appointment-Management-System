// Data access for appointments. Also reads names from "departments" and "services" (owned by
// department-service) for appointments stored without departmentName/serviceName.
import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model.js";

const departments = () => mongoose.connection.collection("departments");
const services = () => mongoose.connection.collection("services");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (s) => new RegExp(escapeRegex(s), "i"); // ILIKE '%s%'

/** Inserts and returns the plain document. */
export async function create(doc) {
  return (await Appointment.create(doc)).toObject();
}

export const findById = (id) => Appointment.findById(id).lean();

/** Appointments of a service on a date that take a place (not CANCELLED or REJECTED). */
export const countHoldingPlace = (serviceId, date) =>
  Appointment.countDocuments({ serviceId, date, status: { $nin: ["CANCELLED", "REJECTED"] } });

/** Latest appointment whose reference number or citizen phone equals ref. */
export const findLatestByReferenceOrPhone = (ref) =>
  Appointment.findOne({ $or: [{ referenceNumber: ref }, { citizenPhone: ref }] }).sort({ createdAt: -1 }).lean();

/** A citizen's appointments, newest date first. status: one value or a list; search: reference or service name. */
export function findByCitizen({ citizenId, fromDate, status, search }) {
  const filter = { citizenId };
  if (fromDate !== undefined) filter.date = { $gte: fromDate };
  if (status !== undefined) filter.status = Array.isArray(status) ? { $in: status } : status;
  if (search) filter.$or = [{ referenceNumber: contains(search) }, { serviceName: contains(search) }];
  return Appointment.find(filter).sort({ date: -1, createdAt: -1 }).lean();
}

/** One page of the registry plus the total count.
 *  date: exact date; afterDate: dates strictly later; search: citizen name, reference or phone. */
export async function findPage({ departmentId, status, date, afterDate, search }, { page, limit }) {
  const filter = {};
  if (departmentId) filter.departmentId = departmentId;
  if (status) filter.status = status;
  if (date !== undefined) filter.date = date;
  else if (afterDate !== undefined) filter.date = { $gt: afterDate };
  if (search) {
    const re = contains(search);
    filter.$or = [{ citizenName: re }, { referenceNumber: re }, { citizenPhone: re }];
  }
  const [total, docs] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.find(filter).sort({ date: 1, timeSlot: 1, _id: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { docs, total };
}

/** Sets fields only when the appointment still matches `where`; returns the updated document or null. */
export const updateIf = (id, where, fields) =>
  Appointment.findOneAndUpdate({ _id: id, ...where }, { $set: fields }, { new: true, lean: true });

/** {total, completed, noShow, cancelled} for appointment dates in [from, to), or undefined when none. */
export async function countOutcomes({ from, to, departmentId }) {
  const match = { date: { $gte: from, $lt: to } };
  if (departmentId) match.departmentId = departmentId;
  const count = (status) => ({ $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } });
  const [row] = await Appointment.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: 1 }, completed: count("COMPLETED"), noShow: count("NO_SHOW"), cancelled: count("CANCELLED") } },
  ]);
  return row;
}

/** {departmentId -> name} and {serviceId -> name} for the given ids. */
export async function findNames(departmentIds, serviceIds) {
  const [depts, svcs] = await Promise.all([
    departments().find({ _id: { $in: departmentIds } }, { projection: { name: 1 } }).toArray(),
    services().find({ _id: { $in: serviceIds } }, { projection: { name: 1 } }).toArray(),
  ]);
  return {
    departmentNames: new Map(depts.map((d) => [d._id, d.name])),
    serviceNames: new Map(svcs.map((s) => [s._id, s.name])),
  };
}
