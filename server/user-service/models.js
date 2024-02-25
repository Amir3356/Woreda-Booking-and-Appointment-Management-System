// Collections owned by user-service. auth-service defines the
// identical User model, so field names and index specs must stay in step with it.
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

// Defaults of the old system_settings table (migration 000001).
export const SETTINGS_DEFAULTS = Object.freeze({
  woredaName: "Woreda 03 Public Administration",
  cityRegion: "Addis Ababa City Administration",
  hotline: "9840",
  receptionPhone: "+251 11 551 0000",
  smsGatewayActive: true,
  autoApproveBookings: false,
  advanceBookingDays: 14,
  cancellationCutoffHours: 4,
  maxParallelSlots: 3,
});

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "primary" },
    woredaName: { type: String, default: SETTINGS_DEFAULTS.woredaName },
    cityRegion: { type: String, default: SETTINGS_DEFAULTS.cityRegion },
    hotline: { type: String, default: SETTINGS_DEFAULTS.hotline },
    receptionPhone: { type: String, default: SETTINGS_DEFAULTS.receptionPhone },
    smsGatewayActive: { type: Boolean, default: SETTINGS_DEFAULTS.smsGatewayActive },
    autoApproveBookings: { type: Boolean, default: SETTINGS_DEFAULTS.autoApproveBookings },
    advanceBookingDays: { type: Number, default: SETTINGS_DEFAULTS.advanceBookingDays },
    cancellationCutoffHours: { type: Number, default: SETTINGS_DEFAULTS.cancellationCutoffHours },
    maxParallelSlots: { type: Number, default: SETTINGS_DEFAULTS.maxParallelSlots },
  },
  { collection: "system_settings", timestamps: { createdAt: false, updatedAt: true }, versionKey: false, toJSON },
);

export const User = mongoose.model("User", userSchema);
export const Settings = mongoose.model("Settings", settingsSchema);

// Owned by department-service: read only (was a foreign key / LEFT JOIN in Postgres).
export const departments = () => mongoose.connection.collection("departments");
