// Data access for queue tokens (collection "queue_tokens").
import { QueueToken } from "../models/queueToken.model.js";

/** Tokens issued for a department on a day (any status). */
export const countIssued = (departmentId, queueDate, { session } = {}) =>
  QueueToken.countDocuments({ departmentId, queueDate }).session(session ?? null);

/** WAITING tokens of a department on a day. */
export const countWaiting = (departmentId, queueDate, { session } = {}) =>
  QueueToken.countDocuments({ departmentId, queueDate, status: "WAITING" }).session(session ?? null);

/** Inserts one token; a second token for the same appointment fails with a duplicate-key error. */
export const create = (doc, { session } = {}) => QueueToken.create([doc], { session });

/** SERVING tokens of a department on a day, latest call first (plain objects). */
export const findServing = (departmentId, queueDate) =>
  QueueToken.find({ departmentId, queueDate, status: "SERVING" }).sort({ calledTime: -1 }).lean();

/** WAITING tokens of a department on a day, oldest first (plain objects). */
export const findWaiting = (departmentId, queueDate) =>
  QueueToken.find({ departmentId, queueDate, status: "WAITING" }).sort({ createdAt: 1, _id: 1 }).lean();

/**
 * Atomically moves the oldest WAITING token of the department/day to SERVING with the given fields;
 * returns the updated token, or null when nobody is waiting.
 */
export const claimNextWaiting = (departmentId, queueDate, fields, { session } = {}) =>
  QueueToken.collection.findOneAndUpdate(
    { departmentId, queueDate, status: "WAITING" },
    { $set: { status: "SERVING", ...fields, updatedAt: new Date() } },
    { sort: { createdAt: 1, _id: 1 }, returnDocument: "after", session },
  );

/**
 * Closes a WAITING/SERVING token (restricted to departmentId when given) with the final status;
 * returns {_id, appointmentId} of the token, or null when no such open token exists.
 */
export function finalize(id, departmentId, status, { session } = {}) {
  const filter = { _id: id, status: { $in: ["WAITING", "SERVING"] } };
  if (departmentId) filter.departmentId = departmentId;
  return QueueToken.collection.findOneAndUpdate(
    filter,
    { $set: { status, updatedAt: new Date() } },
    { projection: { appointmentId: 1 }, session },
  );
}
