// MongoDB database "woreda". appointment-service owns `appointments` and `slot_reservations`
// (_id "<serviceId>|<date>|<timeSlot>", count; a booking increments it only while below
// system_settings.maxParallelSlots, so a slot is never overbooked). Catalog data comes over gRPC.
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

export const STATUSES = Object.freeze([
  "PENDING", "APPROVED", "REJECTED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW",
]);

const nullable = (type) => ({ type, default: null });

const appointmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    referenceNumber: { type: String, required: true, unique: true },
    citizenId: { type: String, required: true },
    citizenName: { type: String, required: true },
    citizenPhone: { type: String, required: true, index: true },
    citizenEmail: nullable(String),
    departmentId: { type: String, required: true },
    // Copied from the catalog (gRPC) at booking time; the Go version JOINed the tables instead.
    departmentName: { type: String },
    serviceId: { type: String, required: true },
    serviceName: { type: String },
    date: { type: String, required: true }, // YYYY-MM-DD
    timeSlot: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: "PENDING" },
    tokenNumber: nullable(String),
    citizenNotes: nullable(String),
    officerNotes: nullable(String),
    rejectionReason: nullable(String),
    responsibleOfficerId: nullable(String),
    checkedInAt: nullable(Date),
    completedAt: nullable(Date),
  },
  { collection: "appointments", timestamps: true, toJSON },
);
appointmentSchema.index({ serviceId: 1, date: 1, timeSlot: 1 });
appointmentSchema.index({ citizenId: 1, createdAt: -1 });
appointmentSchema.index({ departmentId: 1, date: 1 });

// One document per service/date/slot: _id "<serviceId>|<date>|<timeSlot>", count = places taken.
const slotReservationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { collection: "slot_reservations", versionKey: false },
);

export const Appointment = mongoose.model("Appointment", appointmentSchema);
export const SlotReservation = mongoose.model("SlotReservation", slotReservationSchema);

// Collections owned by other services (plain handles: no schema, no indexes created here).
export const users = () => mongoose.connection.collection("users");
export const settings = () => mongoose.connection.collection("system_settings");
// Only for name fallback on appointments stored without departmentName/serviceName.
export const departments = () => mongoose.connection.collection("departments");
export const services = () => mongoose.connection.collection("services");
