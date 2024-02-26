// Data access for users (collection owned by user-service). Reads join departmentName from
// "departments" (owned by department-service), as the Go service's LEFT JOIN did.
import mongoose from "mongoose";
import { User } from "../models/user.model.js";

const caseInsensitive = { locale: "en", strength: 2 };

/** Email compares case-insensitively (Go: LOWER(email) = LOWER($1)). */
export const existsByEmail = (email) => User.exists({ email }).collation(caseInsensitive);

/** National ID compares exactly. */
export const existsByNationalId = (nationalId) => User.exists({ nationalId });

/** Inserts a user (validators run) and returns it as a plain object. */
export async function create(doc) {
  return (await User.create(doc)).toObject();
}

/** One user with departmentName joined from departments, or null. */
async function findOneWithDepartment(match, ignoreCase) {
  const pipeline = [
    { $match: match },
    { $limit: 1 },
    { $lookup: { from: "departments", localField: "departmentId", foreignField: "_id", as: "dept", pipeline: [{ $project: { name: 1 } }] } },
    { $set: { departmentName: { $ifNull: [{ $first: "$dept.name" }, null] } } },
    { $project: { dept: 0 } },
  ];
  const agg = mongoose.connection.collection("users").aggregate(pipeline, ignoreCase ? { collation: caseInsensitive } : {});
  const [user] = await agg.toArray();
  return user ?? null;
}

/** Case-insensitive email lookup (includes passwordHash). */
export const findByEmail = (email) => findOneWithDepartment({ email }, true);

export const findById = (id) => findOneWithDepartment({ _id: id }, false);
