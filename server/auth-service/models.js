// users is owned by user-service; auth-service reads it and inserts citizens on registration.
// This User model is identical to server/user-service/models.js (fields, defaults, validators
// and the shared indexes: email unique, nationalId unique, (role, departmentId)),
// so building the indexes from either service is idempotent. Keep the two in step.
import mongoose from "mongoose";

const toJSON = {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
};

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
