// Collection "audit_logs" (owned by appointment-service): one entry per appointment decision or
// change — booked (Pending), approved, rejected, cancelled, rescheduled — with who did it and when.
// Entries are only ever added, never edited or deleted by the API.
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

const auditLogSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // "aud-..."
    at: { type: Date, required: true },
    action: { type: String, required: true, enum: ["BOOKED", "APPROVED", "REJECTED", "CANCELLED", "RESCHEDULED"] },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    actorId: { type: String, default: null },
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" }, // CITIZEN | OFFICER | ADMIN
    appointmentId: { type: String, required: true },
    referenceNumber: { type: String, default: "" },
    citizenName: { type: String, default: "" },
    departmentId: { type: String, default: null },
    departmentName: { type: String, default: "" },
    serviceName: { type: String, default: "" },
    appointmentDate: { type: String, default: "" },
    timeSlot: { type: String, default: "" },
    reason: { type: String, default: null }, // rejection reason, officer notes or reschedule reason
  },
  { collection: "audit_logs", versionKey: false, toJSON },
);
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ departmentId: 1, at: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
