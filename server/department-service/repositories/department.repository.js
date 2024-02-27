// Data access for departments. Also touches two collections owned by other services, as the
// Postgres foreign keys did: counts officers in "users" and clears users.departmentId on delete.
import mongoose from "mongoose";
import { Department } from "../models/department.model.js";
import { PublicService } from "../models/publicService.model.js";

const users = () => mongoose.connection.collection("users");

/** Sorted by name; isActive undefined = all. */
export const findAll = (isActive) =>
  Department.find(isActive === undefined ? {} : { isActive }).collation({ locale: "en" }).sort({ name: 1 });

export const findById = (id) => Department.findById(id);

export const exists = (id) => Department.exists({ _id: id });

export const create = (doc) => Department.create(doc);

/** Returns false when no department has this id. */
export async function update(id, fields) {
  const res = await Department.updateOne({ _id: id }, { $set: fields });
  return res.matchedCount > 0;
}

/** Flips isActive atomically; returns the new value, or null when not found. */
export async function toggleActive(id) {
  const doc = await Department.collection.findOneAndUpdate(
    { _id: id },
    [{ $set: { isActive: { $not: "$isActive" }, updatedAt: "$$NOW" } }],
    { returnDocument: "after", projection: { isActive: 1 } },
  );
  return doc ? doc.isActive : null;
}

/** Returns false when no department has this id. */
export async function remove(id) {
  const res = await Department.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export const clearFromUsers = (id) =>
  users().updateMany({ departmentId: id }, { $set: { departmentId: null, updatedAt: new Date() } });

/** {departmentId -> number of officers} and {departmentId -> number of services}. */
export async function countsFor(ids) {
  const [officers, services] = await Promise.all([
    users().aggregate([{ $match: { departmentId: { $in: ids }, role: "OFFICER" } }, { $group: { _id: "$departmentId", n: { $sum: 1 } } }]).toArray(),
    PublicService.aggregate([{ $match: { departmentId: { $in: ids } } }, { $group: { _id: "$departmentId", n: { $sum: 1 } } }]),
  ]);
  const toMap = (rows) => new Map(rows.map((r) => [r._id, r.n]));
  return { officers: toMap(officers), services: toMap(services) };
}

/** Inserts the departments that are missing; returns how many were created. */
export async function insertMissing(departments) {
  if (!departments || departments.length === 0) return 0;
  const now = new Date();
  const res = await Department.collection.bulkWrite(
    departments.map(({ _id, ...fields }) => ({
      updateOne: { filter: { _id }, update: { $setOnInsert: { ...fields, isActive: true, createdAt: now, updatedAt: now } }, upsert: true },
    })),
  );
  return res.upsertedCount;
}
