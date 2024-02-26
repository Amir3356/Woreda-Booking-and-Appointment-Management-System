// Data access for the "users" collection (citizen profiles and staff accounts).
import { User } from "../models/user.model.js";

const STAFF = { role: { $ne: "CITIZEN" } };

/** ILIKE '%search%' as a case-insensitive regex (% and _ keep their LIKE meaning). */
export function ilikeContains(search) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(escaped, "i");
}

export const findCitizen = (userId) => User.findOne({ _id: userId, role: "CITIZEN" }).lean();

/** Returns false when no citizen has this id. */
export async function updateCitizen(userId, fields) {
  const res = await User.updateOne({ _id: userId, role: "CITIZEN" }, { $set: fields });
  return res.matchedCount > 0;
}

/** Staff (non-citizen) accounts matching search on fullName/email: {total, rows} for one page, newest first. */
export async function findStaffPage(search, skip, limit) {
  const filter = { ...STAFF };
  if (search !== "") {
    const re = ilikeContains(search);
    filter.$or = [{ fullName: re }, { email: re }];
  }
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, { fullName: 1, email: 1, role: 1, departmentId: 1, isActive: 1 })
      .sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
  ]);
  return { total, rows };
}

export const create = (doc) => User.create(doc);

/** Flips isActive of a staff account atomically (UPDATE ... SET is_active = NOT is_active);
 *  returns the new value, or null when not found. */
export async function toggleStaffActive(id) {
  const u = await User.findOneAndUpdate(
    { _id: id, ...STAFF },
    [{ $set: { isActive: { $not: ["$isActive"] }, updatedAt: "$$NOW" } }],
    { new: true, projection: { isActive: 1 }, lean: true, timestamps: false },
  );
  return u ? u.isActive : null;
}

/** Returns false when no staff account has this id. */
export async function removeStaff(id) {
  const res = await User.deleteOne({ _id: id, ...STAFF });
  return res.deletedCount > 0;
}

/** Inserts the user unless one with this email exists; returns true when created. */
export async function insertIfMissingByEmail(user, now) {
  const res = await User.collection.updateOne(
    { email: user.email },
    { $setOnInsert: { ...user, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  return res.upsertedCount > 0;
}
