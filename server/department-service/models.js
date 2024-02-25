// MongoDB database "woreda". department-service owns `departments` and `services` (string _id such as
// "dept-1" / "srv-7c2b063b8a1c", camelCase fields). It also counts officers in `users`, refuses to delete
// a service that `appointments` reference, and clears users.departmentId / schedules.serviceId on delete.
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

const serviceSchema = new mongoose.Schema(
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

export const Department = mongoose.model("Department", departmentSchema);
export const Service = mongoose.model("Service", serviceSchema);

// Collections owned by other services that the catalog reads or tidies up (as the Go version did
// through foreign keys). Plain collection handles: no schema, no indexes created here.
export const users = () => mongoose.connection.collection("users");
export const appointments = () => mongoose.connection.collection("appointments");
export const schedules = () => mongoose.connection.collection("schedules");
