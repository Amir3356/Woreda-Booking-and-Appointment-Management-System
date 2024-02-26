// Collection "departments" (owned by department-service). _id like "dept-1".
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

const departmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    buildingRoom: { type: String, required: true },
    contactPhone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { collection: "departments", timestamps: true, toJSON },
);

export const Department = mongoose.model("Department", departmentSchema);
