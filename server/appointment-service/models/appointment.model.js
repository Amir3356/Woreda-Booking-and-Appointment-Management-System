// Collection "appointments" (owned by appointment-service). _id like "apt-7c2b063b8a1c".
// Catalog data comes over gRPC; department/service names are copied in at booking time.
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

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

export const Appointment = mongoose.model("Appointment", appointmentSchema);
