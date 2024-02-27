// Data access for schedules. Joins department and service names, as Go's selectSchedule did
// (INNER JOIN departments, LEFT JOIN services): schedules whose department no longer exists are left out.
import { Schedule } from "../models/schedule.model.js";

const joinNames = [
  { $lookup: { from: "departments", localField: "departmentId", foreignField: "_id", as: "dept" } },
  { $unwind: "$dept" },
  { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "srv" } },
];

/** A joined row as the API schedule shape; status stays raw ("ACTIVE" | "INACTIVE"). */
function toSchedule(row) {
  const srv = row.srv?.[0];
  return {
    id: row._id,
    department: row.dept.name,
    departmentId: row.departmentId,
    service: row.serviceId != null && srv ? srv.name : null,
    serviceId: row.serviceId ?? null,
    workingDays: row.workingDays ?? [],
    openingTime: row.openingTime,
    closingTime: row.closingTime,
    dailyCapacity: row.dailyCapacity,
    effectiveStartDate: row.effectiveStartDate,
    effectiveEndDate: row.effectiveEndDate ?? null,
    status: row.status,
  };
}

/** All schedules, ordered by department name, then newest effective start first. */
export async function findAll() {
  const rows = await Schedule.aggregate([...joinNames, { $sort: { "dept.name": 1, effectiveStartDate: -1 } }]).collation({ locale: "en" });
  return rows.map(toSchedule);
}

/** One schedule with names, or null. */
export async function findById(id) {
  const [row] = await Schedule.aggregate([{ $match: { _id: id } }, ...joinNames]);
  return row ? toSchedule(row) : null;
}

export const create = (doc) => Schedule.create(doc);

/** Replaces the editable fields; false when the schedule does not exist. */
export async function update(id, fields) {
  const res = await Schedule.updateOne({ _id: id }, { $set: fields });
  return res.matchedCount > 0;
}

/** Flips ACTIVE <-> INACTIVE; returns the new status, or null when the schedule does not exist. */
export async function toggleStatus(id) {
  const doc = await Schedule.findOneAndUpdate(
    { _id: id },
    [{ $set: { status: { $cond: [{ $eq: ["$status", "ACTIVE"] }, "INACTIVE", "ACTIVE"] } } }],
    { new: true, projection: { status: 1 } },
  );
  return doc ? doc.status : null;
}

/** false when the schedule does not exist. */
export async function remove(id) {
  const res = await Schedule.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

/** ACTIVE schedules whose effective period has not ended before date (the citizen booking page). */
export async function findBookable(date) {
  const rows = await Schedule.aggregate([
    { $match: { status: "ACTIVE", $or: [{ effectiveEndDate: null }, { effectiveEndDate: { $gte: date } }] } },
    ...joinNames,
    { $sort: { "dept.name": 1, effectiveStartDate: 1 } },
  ]).collation({ locale: "en" });
  return rows.map(toSchedule);
}

/**
 * The ACTIVE schedule effective on date for the service itself or, when service (the catalog
 * document, or null) is given, department-wide (serviceId null) for the service's department.
 * A service-specific schedule wins over a department-wide one. Null if none.
 */
export async function findActive(serviceId, service, date) {
  const scope = [{ serviceId }];
  if (service) scope.push({ serviceId: null, departmentId: service.departmentId });
  const rows = await Schedule.aggregate([
    {
      $match: {
        status: "ACTIVE",
        $or: scope,
        effectiveStartDate: { $lte: date },
        $and: [{ $or: [{ effectiveEndDate: null }, { effectiveEndDate: { $gte: date } }] }],
      },
    },
    ...joinNames,
    { $addFields: { departmentWide: { $cond: [{ $eq: [{ $ifNull: ["$serviceId", null] }, null] }, 1, 0] } } },
    { $sort: { departmentWide: 1 } }, // ORDER BY service_id NULLS LAST
    { $limit: 1 },
  ]);
  return rows.length ? toSchedule(rows[0]) : null;
}
