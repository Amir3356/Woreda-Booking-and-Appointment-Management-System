// MongoDB database "woreda". booking-service owns `schedules`, `queue_tokens` and `queue_counters`
// (per department and day, written first in each check-in transaction so token numbers never repeat).
// It reads services, departments, users and system_settings, counts appointments per slot, and updates
// appointment status/token fields during check-in, call-next and finalize (in transactions).
import mongoose from "mongoose";

const toJSON = {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
};

const scheduleSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    departmentId: { type: String, required: true, index: true },
    serviceId: { type: String, default: null },
    workingDays: { type: [String], default: () => ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    openingTime: { type: String, default: "08:30" }, // "HH:MM"
    closingTime: { type: String, default: "17:30" },
    dailyCapacity: { type: Number, default: 40, min: 1 },
    effectiveStartDate: { type: String, required: true }, // "YYYY-MM-DD"
    effectiveEndDate: { type: String, default: null },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { collection: "schedules", timestamps: true, toJSON },
);
scheduleSchema.index({ serviceId: 1, status: 1 });

const queueTokenSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    appointmentId: { type: String, required: true, unique: true },
    tokenNumber: { type: String, required: true },
    departmentId: { type: String, required: true },
    counterNumber: { type: Number, default: 1 },
    officerId: { type: String, default: null },
    status: { type: String, enum: ["WAITING", "SERVING", "COMPLETED", "NO_SHOW"], default: "WAITING" },
    checkedInTime: { type: String, required: true }, // "HH:MM:SS"
    calledTime: { type: String, default: null }, // "HH:MM:SS"
    estimatedMinutesRemaining: { type: Number, default: 15 },
    queueDate: { type: String, required: true }, // "YYYY-MM-DD"
  },
  { collection: "queue_tokens", timestamps: true, toJSON },
);
queueTokenSchema.index({ departmentId: 1, queueDate: 1, status: 1, createdAt: 1 });

export const Schedule = mongoose.model("Schedule", scheduleSchema);
export const QueueToken = mongoose.model("QueueToken", queueTokenSchema);

// Per-department, per-day check-in lock (_id "<departmentId>|<queueDate>"). Every check-in
// transaction writes this document first, so concurrent check-ins of one department conflict and
// are retried one after another: the Mongo replacement for Go's pg_advisory_xact_lock, which kept
// token numbers ({CODE}-{count+1}) unique. Owned by booking-service; no indexes beyond _id.
export const queueCounters = () => mongoose.connection.collection("queue_counters");

// Collections owned by other services that booking-service reads (and, for appointments,
// updates during check-in, call-next and finalize). Plain handles: no schema, no indexes.
export const appointments = () => mongoose.connection.collection("appointments");
export const services = () => mongoose.connection.collection("services");
export const departments = () => mongoose.connection.collection("departments");
export const users = () => mongoose.connection.collection("users");
export const systemSettings = () => mongoose.connection.collection("system_settings");
