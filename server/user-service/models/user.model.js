// Collection "users" (owned by user-service). auth-service defines the
// identical User model, so field names and index specs must stay in step with it.
import mongoose from "mongoose";
import { toJSON } from "./toJSON.js";

export const ROLE_VALUES = ["CITIZEN", "OFFICER", "ADMIN"];

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    role: { type: String, enum: ROLE_VALUES, default: "CITIZEN" },
    departmentId: { type: String, default: null },
    // CHECK (counter_number IS NULL OR counter_number > 0)
    counterNumber: {
      type: Number,
      default: null,
      validate: { validator: (v) => v == null || (Number.isInteger(v) && v > 0), message: "counterNumber must be greater than 0" },
    },
    address: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { collection: "users", timestamps: true, versionKey: false, toJSON },
);
userSchema.index({ role: 1, departmentId: 1 });
// CONSTRAINT chk_officer_department: officers always belong to a department.
userSchema.pre("validate", function officerDepartment(next) {
  if (this.role === "OFFICER" && !this.departmentId) this.invalidate("departmentId", "Officers must be assigned to a department.");
  next();
});

export const User = mongoose.model("User", userSchema);
