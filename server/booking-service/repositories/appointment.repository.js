// Reads and status updates of "appointments" (owned by appointment-service): per-slot booking
// counts, and the desk's check-in, call-next and finalize writes (inside the queue transactions).
import mongoose from "mongoose";

const appointments = () => mongoose.connection.collection("appointments");

/** Active bookings (not CANCELLED/REJECTED) per time slot for a service on date: {"09:00 AM": n}. */
export async function countBySlot(serviceId, date) {
  const rows = await appointments()
    .aggregate([
      { $match: { serviceId, date, status: { $nin: ["CANCELLED", "REJECTED"] } } },
      { $group: { _id: "$timeSlot", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

/** {_id, status, departmentId, serviceId, citizenName} or null. */
export const findForCheckIn = (id) =>
  appointments().findOne({ _id: id }, { projection: { status: 1, departmentId: 1, serviceId: 1, citizenName: 1 } });

/** [{_id, citizenName, serviceId}] for the given ids that exist. */
export const findCitizens = (ids) =>
  appointments().find({ _id: { $in: ids } }, { projection: { citizenName: 1, serviceId: 1 } }).toArray();

/** APPROVED -> CHECKED_IN with the token number; false when the appointment is no longer APPROVED. */
export async function markCheckedIn(id, tokenNumber, now, { session } = {}) {
  const res = await appointments().updateOne(
    { _id: id, status: "APPROVED" },
    { $set: { status: "CHECKED_IN", tokenNumber, checkedInAt: now, updatedAt: now } },
    { session },
  );
  return res.matchedCount > 0;
}

/** Sets IN_PROGRESS; returns the citizen's name ("" when unknown). */
export async function markInProgress(id, { session } = {}) {
  const appt = await appointments().findOneAndUpdate(
    { _id: id },
    { $set: { status: "IN_PROGRESS", updatedAt: new Date() } },
    { projection: { citizenName: 1 }, session },
  );
  return appt?.citizenName ?? "";
}

/** Sets COMPLETED (with completedAt) or NO_SHOW. */
export async function markFinal(id, status, { session } = {}) {
  const now = new Date();
  const set = { status, updatedAt: now };
  if (status === "COMPLETED") set.completedAt = now;
  await appointments().updateOne({ _id: id }, { $set: set }, { session });
}
