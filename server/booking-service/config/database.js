// MongoDB connection (database "woreda", replica set rs0) and index creation for owned models.
// booking-service owns `schedules`, `queue_tokens` and `queue_counters`; the other collections it
// reads (and, for appointments, updates) are reached through the repositories.
import mongoose from "mongoose";
import { config } from "./index.js";
import { Schedule } from "../models/schedule.model.js";
import { QueueToken } from "../models/queueToken.model.js";

export async function connectDatabase() {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Schedule.init(), QueueToken.init()]); // builds the indexes
}

export const disconnectDatabase = () => mongoose.disconnect();
