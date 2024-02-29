// MongoDB connection (database "woreda", replica set rs0) and index creation for owned models.
import mongoose from "mongoose";
import { config } from "./index.js";
import { Appointment } from "../models/appointment.model.js";
import { SlotReservation } from "../models/slotReservation.model.js";
import { AuditLog } from "../models/auditLog.model.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Appointment.init(), SlotReservation.init(), AuditLog.init()]); // builds the indexes
}

export const disconnectDatabase = () => mongoose.disconnect();
