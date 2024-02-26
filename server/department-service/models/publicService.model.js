// Collection "services" (owned by department-service): the public services citizens book.
// _id like "srv-7c2b063b8a1c".
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

const publicServiceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    departmentId: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    durationMinutes: { type: Number, default: 30, min: 1 },
    dailyQuota: { type: Number, default: 40, min: 1 },
    feeETB: { type: Number, default: 0, min: 0 },
    processingDays: { type: String, default: "Same day" },
    requiredDocuments: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { collection: "services", timestamps: true, toJSON },
);

export const PublicService = mongoose.model("Service", publicServiceSchema);
