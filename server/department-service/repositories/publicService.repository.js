// Data access for public services. Also reads/updates collections owned by other services, as the
// Postgres foreign keys did: appointments.serviceId (RESTRICT) and schedules.serviceId (SET NULL).
import mongoose from "mongoose";
import { PublicService } from "../models/publicService.model.js";

const appointments = () => mongoose.connection.collection("appointments");
const schedules = () => mongoose.connection.collection("schedules");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Filters: departmentId, search (name or code, case-insensitive), isActive. Sorted by name. */
export function findAll({ departmentId, search, isActive }) {
  const filter = {};
  if (departmentId) filter.departmentId = departmentId;
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: re }, { code: re }];
  }
  if (isActive !== undefined) filter.isActive = isActive;
  return PublicService.find(filter).collation({ locale: "en" }).sort({ name: 1 });
}

export const findById = (id) => PublicService.findById(id);

export const existsInDepartment = (departmentId) => PublicService.exists({ departmentId });

export const create = (doc) => PublicService.create(doc);

/** Returns false when no service has this id. */
export async function update(id, fields) {
  const res = await PublicService.updateOne({ _id: id }, { $set: fields });
  return res.matchedCount > 0;
}

/** Flips isActive atomically; returns the new value, or null when not found. */
export async function toggleActive(id) {
  const doc = await PublicService.collection.findOneAndUpdate(
    { _id: id },
    [{ $set: { isActive: { $not: "$isActive" }, updatedAt: "$$NOW" } }],
    { returnDocument: "after", projection: { isActive: 1 } },
  );
  return doc ? doc.isActive : null;
}

/** Returns false when no service has this id. */
export async function remove(id) {
  const res = await PublicService.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export async function hasAppointments(id) {
  return Boolean(await appointments().findOne({ serviceId: id }, { projection: { _id: 1 } }));
}

export const clearFromSchedules = (id) =>
  schedules().updateMany({ serviceId: id }, { $set: { serviceId: null, updatedAt: new Date() } });
