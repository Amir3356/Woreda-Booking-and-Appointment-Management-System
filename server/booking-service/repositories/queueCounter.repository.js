// Collection "queue_counters" (owned by booking-service; no indexes beyond _id): the per-department,
// per-day check-in lock (_id "<departmentId>|<queueDate>"). Every check-in transaction writes this
// document first, so concurrent check-ins of one department conflict and are retried one after
// another: the Mongo replacement for Go's pg_advisory_xact_lock, which kept token numbers unique.
import mongoose from "mongoose";

const queueCounters = () => mongoose.connection.collection("queue_counters");

export const lockDay = (departmentId, queueDate, { session } = {}) =>
  queueCounters().updateOne(
    { _id: `${departmentId}|${queueDate}` },
    { $inc: { seq: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, session },
  );
