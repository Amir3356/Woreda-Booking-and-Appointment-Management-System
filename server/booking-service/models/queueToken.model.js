// Collection "queue_tokens" (owned by booking-service): one desk queue token per checked-in
// appointment. _id like "q-7c2b063b8a1c".
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

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

export const QueueToken = mongoose.model("QueueToken", queueTokenSchema);
