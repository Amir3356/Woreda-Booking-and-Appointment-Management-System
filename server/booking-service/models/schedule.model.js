// Collection "schedules" (owned by booking-service): operating hours per department, optionally
// per service. _id like "SCH-7c2b063b8a1c".
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

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

export const Schedule = mongoose.model("Schedule", scheduleSchema);
